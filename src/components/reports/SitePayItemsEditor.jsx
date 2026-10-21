import { useEffect, useMemo, useState } from 'react'
import { addSitePayItem, listSitePayItems, removeSitePayItem, updateSitePayItem } from '../../services/api'
import { autoSourceText } from '../../lib/idrSiteContext'
import { formatPayItemQuantity } from '../../lib/payItemFormat'

/**
 * One site's pay items for an IDR as one table (Slice X; the hand-entered ones since Slice V1), on the site's own page
 * in the IDR's context (SitePayItemsPanel): Item · Description · Quantity · Unit · Source · Actions. First the auto
 * rows, what the site's flags and curb segments come to for the IDR (autoRows, siteGeometryRows'), read-only: their
 * quantity can't be overridden. Then the pay items entered by hand on the site (Source "entered"); unless read-only,
 * each one's quantity (above 0) and note are saved on blur, Delete removes it, and a "+ Add pay item" row at the foot
 * (a contract-item picker, quantity and note) adds one.
 * Props: idrId, reportId, site (its row), contractItems (the project's), autoRows, isReadOnly,
 * onChanged() after any change (the page reloads its pay-item totals).
 */
export default function SitePayItemsEditor({ idrId, reportId, site, contractItems = [], autoRows = [], isReadOnly, onChanged }) {
  const [state, setState] = useState({ status: 'loading', error: null, rows: [] })
  const [draft, setDraft] = useState({ contractItemId: '', quantity: '', note: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let ignore = false
    listSitePayItems(idrId, reportId, site.id)
      .then(rows => { if (!ignore) setState({ status: 'ready', error: null, rows }) })
      .catch(err => { if (!ignore) setState({ status: 'error', error: err.message, rows: [] }) })
    return () => { ignore = true }
  }, [idrId, reportId, site.id])

  const options = useMemo(() => [...contractItems].sort((a, b) =>
    `${a.item_no} ${a.budget_code}`.localeCompare(`${b.item_no} ${b.budget_code}`)), [contractItems])
  const picked = options.find(item => item.contract_item_id === draft.contractItemId)

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
    if (field === 'quantity' && !(Number(value) > 0)) return setError('Enter a quantity above 0')
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
            {/* What the sketch gives: read-only, no override */}
            {autoRows.map(row => (
              <tr key={`auto-${row.key}`}>
                {itemCell(row)}
                <td className="py-2 pr-3">{row.description}</td>
                <td className="py-2 pr-3 text-right whitespace-nowrap">{formatPayItemQuantity(row.amount)}</td>
                <td className="py-2 pr-3">{row.unit}</td>
                <td className="py-2 pr-3 whitespace-nowrap text-gray-600">{autoSourceText(row)}</td>
                <td className="py-2 text-xs text-gray-500">from the sketch</td>
              </tr>
            ))}
            {/* Entered by hand on the site */}
            {state.rows.map(row => (
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
                <td className="py-2 pr-3 text-gray-600">entered</td>
                <td className="py-2">
                  {!isReadOnly && (
                    <button type="button" className="text-red-600 underline" disabled={busy} onClick={() => remove(row)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
            {autoRows.length === 0 && state.rows.length === 0 && (
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
