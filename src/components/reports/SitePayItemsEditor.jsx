import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { addSitePayItem, listSitePayItems, removeSitePayItem, updateSitePayItem } from '../../services/api'
import { autoSourceText } from '../../lib/idrSiteContext'
import { formatPayItemQuantity } from '../../lib/payItemFormat'

/** An override's audit entry as the table prints it: "overrode auto 180 SF → 185 SF · Jane Doe · 10/21/26 2:05 PM". */
export function auditLine(entry) {
  const at = entry.at ? format(parseISO(entry.at), 'M/d/yy h:mm a') : null
  return [entry.text, entry.actor_name, at].filter(Boolean).join(' · ')
}

/**
 * One site's pay items for an IDR as one table (Slice X; the hand-entered ones since Slice V1), on the site's own page
 * in the IDR's context (SitePayItemsPanel): Item · Description · Quantity · Unit · Source · Actions. First the auto
 * rows, what the site's flags and curb segments come to for the IDR (autoRows, siteGeometryRows'). Their quantity can be
 * overridden (Slice X.1): unless read-only it is a box, and a changed value (0 or more) saved on blur becomes the site's
 * override for that pay item (overrides_auto: POSTed the first time, PATCHed after), which replaces the auto amount;
 * "Auto Calculate" deletes the override, re-reads the flags and segments (onReloadAuto) and shows what they come to. An
 * overridden row reads "auto (8 flags) · edited" with "originally 180 SF" (the auto amount now) under its quantity, and
 * the latest override entry for its pay item (the list's audit) under the row. Then the pay items entered by hand on
 * the site (Source "entered"), and any override whose pay item no longer has an auto row ("override (no flags left)");
 * unless read-only, each one's quantity (above 0; 0 or more for an override) and note are saved on blur, Delete removes
 * it, and a "+ Add pay item" row at the foot (a contract-item picker, quantity and note) adds an ordinary one.
 * Props: idrId, reportId, site (its row), contractItems (the project's), autoRows, isReadOnly,
 * onChanged() after any change (the page reloads its pay-item totals), onReloadAuto() (re-reads the auto rows; may
 * return a promise).
 */
export default function SitePayItemsEditor({
  idrId, reportId, site, contractItems = [], autoRows = [], isReadOnly, onChanged, onReloadAuto,
}) {
  const [state, setState] = useState({ status: 'loading', error: null, rows: [], audit: [] })
  const [draft, setDraft] = useState({ contractItemId: '', quantity: '', note: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [resets, setResets] = useState(0) // bumped by Auto Calculate, so the boxes show their value afresh

  useEffect(() => {
    let ignore = false
    listSitePayItems(idrId, reportId, site.id)
      .then(({ rows, audit }) => { if (!ignore) setState({ status: 'ready', error: null, rows, audit }) })
      .catch(err => { if (!ignore) setState({ status: 'error', error: err.message, rows: [], audit: [] }) })
    return () => { ignore = true }
  }, [idrId, reportId, site.id])

  const options = useMemo(() => [...contractItems].sort((a, b) =>
    `${a.item_no} ${a.budget_code}`.localeCompare(`${b.item_no} ${b.budget_code}`)), [contractItems])
  const picked = options.find(item => item.contract_item_id === draft.contractItemId)

  // An auto row's contract item: its flags' pay item, else the project's item of that number and budget code
  const contractItemIdOf = (row) => row.pay_item_id ?? contractItems.find(item =>
    item.item_no === row.pay_item_ref && item.budget_code === row.budget_code)?.contract_item_id ?? null
  const autoIds = new Set(autoRows.map(contractItemIdOf).filter(Boolean))
  const overrideOf = (row) => {
    const id = contractItemIdOf(row)
    return id ? state.rows.find(r => r.overrides_auto && r.contract_item_id === id) ?? null : null
  }
  const auditOf = (row) => {
    const id = contractItemIdOf(row)
    return id ? state.audit.find(entry => entry.contract_item_id === id) ?? null : null
  }
  // The rows listed under the auto ones: those entered, and overrides whose pay item has no auto row left
  const listed = state.rows.filter(r => !r.overrides_auto || !autoIds.has(r.contract_item_id))

  const run = async (work) => {
    setBusy(true)
    setError(null)
    try {
      await work()
      onChanged?.()
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  // Reads the rows and the audit again, after an override changes (the backend writes its entry)
  const refresh = async () => {
    const { rows, audit } = await listSitePayItems(idrId, reportId, site.id)
    setState(s => ({ ...s, rows, audit }))
  }

  const add = async () => {
    const quantity = Number(draft.quantity)
    if (!draft.contractItemId) return setError('Pick a pay item')
    if (!(quantity > 0)) return setError('Enter a quantity above 0')
    const done = await run(async () => {
      const row = await addSitePayItem(idrId, reportId, site.id, {
        contract_item_id: draft.contractItemId, quantity: draft.quantity.trim(), note: draft.note.trim() || null,
      })
      setState(s => ({ ...s, rows: [...s.rows, row] }))
    })
    if (done) setDraft({ contractItemId: '', quantity: '', note: '' })
  }

  const change = (row, field, raw) => {
    const value = field === 'note' ? (raw.trim() || null) : raw.trim()
    if (field === 'quantity') {
      if (row.overrides_auto && !(value !== '' && Number(value) >= 0)) return setError('Enter a quantity of 0 or more')
      if (!row.overrides_auto && !(Number(value) > 0)) return setError('Enter a quantity above 0')
    }
    if (field === 'quantity' ? Number(value) === Number(row.quantity) : value === (row.note ?? null)) return
    run(async () => {
      const updated = await updateSitePayItem(idrId, reportId, site.id, row.id, { [field]: value })
      setState(s => ({ ...s, rows: s.rows.map(r => (r.id === updated.id ? updated : r)) }))
    })
  }

  const remove = (row) => run(async () => {
    await removeSitePayItem(idrId, reportId, site.id, row.id)
    setState(s => ({ ...s, rows: s.rows.filter(r => r.id !== row.id) }))
  })

  // An auto row's box: a changed value (0 or more) becomes the site's override for its pay item
  const changeAuto = (row, raw) => {
    const value = raw.trim()
    if (value === '' || !(Number(value) >= 0)) return setError('Enter a quantity of 0 or more')
    const override = overrideOf(row)
    if (Number(value) === (override ? Number(override.quantity) : row.amount)) return
    const contractItemId = contractItemIdOf(row)
    if (!contractItemId) return setError(`${row.pay_item_ref} isn't one of the project's pay items`)
    run(async () => {
      if (override) {
        await updateSitePayItem(idrId, reportId, site.id, override.id, { quantity: value })
      } else {
        await addSitePayItem(idrId, reportId, site.id,
          { contract_item_id: contractItemId, quantity: value, note: null, overrides_auto: true })
      }
      await refresh()
    })
  }

  // Auto Calculate: drops the override, if any, and shows what the flags and segments come to now
  const autoCalculate = (row) => run(async () => {
    const override = overrideOf(row)
    if (override) await removeSitePayItem(idrId, reportId, site.id, override.id)
    await Promise.all([refresh(), onReloadAuto?.()])
    setResets(n => n + 1)
  })

  const itemCell = (row) => (
    <td className="py-2 pr-3 whitespace-nowrap">{row.pay_item_ref} <span className="text-gray-500">({row.budget_code})</span></td>
  )

  return (
    <div aria-label={`Pay items at ${site.display_address}`}>
      {error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}
      {state.status === 'loading' ? (
        <p className="text-sm text-gray-500">Loading pay items…</p>
      ) : state.status === 'error' ? (
        <p className="text-sm text-red-600">Couldn't load the pay items: {state.error}</p>
      ) : (
        <table className="min-w-full text-sm" aria-label="Pay items for this site">
          <thead>
            <tr className="text-left text-gray-600">
              <th className="py-1 pr-3">Item</th>
              <th className="py-1 pr-3">Description</th>
              <th className="py-1 pr-3 text-right">Quantity</th>
              <th className="py-1 pr-3">Unit</th>
              <th className="py-1 pr-3">Source</th>
              <th className="py-1">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {/* What the sketch gives, or the site's override of it */}
            {autoRows.map(row => {
              const override = overrideOf(row)
              const shown = override ? Number(override.quantity) : row.amount
              const audit = auditOf(row)
              return [
                <tr key={`auto-${row.key}`}>
                  {itemCell(row)}
                  <td className="py-2 pr-3">{row.description}</td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">
                    {isReadOnly ? formatPayItemQuantity(shown) : (
                      <input key={`${shown}-${resets}`} type="number" min="0" step="any"
                        className="input-field w-24 text-right" defaultValue={shown}
                        aria-label={`Auto quantity of ${row.pay_item_ref}`} disabled={busy}
                        onBlur={(e) => changeAuto(row, e.target.value)} />
                    )}
                    {override && (
                      <div className="text-xs text-gray-500">originally {formatPayItemQuantity(row.amount)} {row.unit}</div>
                    )}
                  </td>
                  <td className="py-2 pr-3">{row.unit}</td>
                  <td className="py-2 pr-3 whitespace-nowrap text-gray-600">
                    {autoSourceText(row)}{override && ' · edited'}
                  </td>
                  <td className="py-2">
                    {isReadOnly ? <span className="text-xs text-gray-500">from the sketch</span> : (
                      <button type="button" className="text-construction-700 underline whitespace-nowrap" disabled={busy}
                        title="Drop any override and use what the flags and curb segments come to now"
                        onClick={() => autoCalculate(row)}>
                        Auto Calculate
                      </button>
                    )}
                  </td>
                </tr>,
                audit && (
                  <tr key={`audit-${row.key}`} data-testid={`override-audit-${row.key}`}>
                    <td colSpan={6} className="pb-2 text-xs text-gray-500">{auditLine(audit)}</td>
                  </tr>
                ),
              ]
            })}
            {/* Entered by hand on the site, and overrides left without flags */}
            {listed.map(row => (
              <tr key={row.id}>
                {itemCell(row)}
                <td className="py-2 pr-3">
                  {row.description}
                  {isReadOnly ? (
                    row.note && <div className="text-xs text-gray-500">{row.note}</div>
                  ) : (
                    <input type="text" maxLength={2000} placeholder="Note (optional)"
                      className="input-field mt-1 block w-full py-1 text-xs" defaultValue={row.note ?? ''}
                      aria-label={`Note on ${row.pay_item_ref}`} disabled={busy}
                      onBlur={(e) => change(row, 'note', e.target.value)} />
                  )}
                </td>
                <td className="py-2 pr-3 text-right whitespace-nowrap">
                  {isReadOnly ? formatPayItemQuantity(Number(row.quantity)) : (
                    <input type="number" min="0" step="any" className="input-field w-24 text-right" defaultValue={row.quantity}
                      aria-label={`Quantity of ${row.pay_item_ref}`} disabled={busy}
                      onBlur={(e) => change(row, 'quantity', e.target.value)} />
                  )}
                </td>
                <td className="py-2 pr-3">{row.unit}</td>
                <td className="py-2 pr-3 text-gray-600">{row.overrides_auto ? 'override (no flags left)' : 'entered'}</td>
                <td className="py-2">
                  {!isReadOnly && (
                    <button type="button" className="text-red-600 underline" disabled={busy} onClick={() => remove(row)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
            {autoRows.length === 0 && listed.length === 0 && (
              <tr>
                <td colSpan={6} className="py-2 text-gray-500">No pay items for this site yet.</td>
              </tr>
            )}
          </tbody>
          {!isReadOnly && (
            <tfoot>
              <tr className="border-t border-gray-300 align-top">
                <td colSpan={2} className="py-2 pr-3">
                  <select aria-label="Pay item" className="input-field w-full" value={draft.contractItemId}
                    onChange={(e) => setDraft(d => ({ ...d, contractItemId: e.target.value }))}>
                    <option value="">Pick a pay item…</option>
                    {options.map(item => (
                      <option key={item.contract_item_id} value={item.contract_item_id}>
                        {item.item_no} ({item.budget_code}) — {item.description}
                      </option>
                    ))}
                  </select>
                  <input type="text" aria-label="Note" placeholder="Note (optional)" maxLength={2000}
                    className="input-field mt-1 block w-full py-1 text-xs"
                    value={draft.note} onChange={(e) => setDraft(d => ({ ...d, note: e.target.value }))} />
                </td>
                <td className="py-2 pr-3 text-right">
                  <input type="number" min="0" step="any" aria-label="Quantity" placeholder="Quantity"
                    className="input-field w-24 text-right" value={draft.quantity}
                    onChange={(e) => setDraft(d => ({ ...d, quantity: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
                </td>
                <td className="py-2 pr-3 text-gray-600">{picked?.pay_unit ?? ''}</td>
                <td className="py-2 pr-3" />
                <td className="py-2">
                  <button type="button" className="btn-secondary whitespace-nowrap" disabled={busy} onClick={add}>
                    + Add pay item
                  </button>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </div>
  )
}
