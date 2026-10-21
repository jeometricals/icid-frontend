import { useEffect, useMemo, useState } from 'react'
import { addSitePayItem, listSitePayItems, removeSitePayItem, updateSitePayItem } from '../../services/api'
import { formatPayItemQuantity } from '../../lib/payItemFormat'

/**
 * The pay items entered by hand on one imported site (Slice V1), opened from its row's "Pay items (N)": a list with
 * each item's quantity and note, and, unless read-only, a contract-item picker, quantity and note to add one, the
 * quantity and note editable in place and a Remove button. They add to what the site's flags and curb segments fill.
 * Props: idrId, reportId, site (its row), contractItems (the project's, from useReportForm), isReadOnly,
 * onChanged() after any change (the page reloads its pay-item totals).
 */
export default function SitePayItemsEditor({ idrId, reportId, site, contractItems = [], isReadOnly, onChanged }) {
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

  const add = async (e) => {
    e.preventDefault()
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

  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-3" aria-label={`Pay items at ${site.display_address}`}>
      {error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}
      {state.status === 'loading' ? (
        <p className="text-sm text-gray-500">Loading pay items…</p>
      ) : state.status === 'error' ? (
        <p className="text-sm text-red-600">Couldn't load the pay items: {state.error}</p>
      ) : state.rows.length === 0 ? (
        <p className="text-sm text-gray-500">No pay items entered on this site.</p>
      ) : (
        <table className="min-w-full text-sm mb-2">
          <thead>
            <tr className="text-left text-gray-600">
              <th className="py-1 pr-3">Item</th>
              <th className="py-1 pr-3">Description</th>
              <th className="py-1 pr-3">Quantity</th>
              <th className="py-1 pr-3">Note</th>
              {!isReadOnly && <th className="py-1"><span className="sr-only">Remove</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {state.rows.map(row => (
              <tr key={row.id}>
                <td className="py-1 pr-3 whitespace-nowrap">{row.pay_item_ref} <span className="text-gray-500">({row.budget_code})</span></td>
                <td className="py-1 pr-3">{row.description}</td>
                <td className="py-1 pr-3 whitespace-nowrap">
                  {isReadOnly ? `${formatPayItemQuantity(row.quantity)} ${row.unit}` : (
                    <>
                      <input type="number" min="0" step="any" className="input-field w-24" defaultValue={row.quantity}
                        aria-label={`Quantity of ${row.pay_item_ref}`} disabled={busy}
                        onBlur={(e) => change(row, 'quantity', e.target.value)} /> {row.unit}
                    </>
                  )}
                </td>
                <td className="py-1 pr-3">
                  {isReadOnly ? (row.note ?? '') : (
                    <input type="text" maxLength={2000} className="input-field" defaultValue={row.note ?? ''}
                      aria-label={`Note on ${row.pay_item_ref}`} disabled={busy}
                      onBlur={(e) => change(row, 'note', e.target.value)} />
                  )}
                </td>
                {!isReadOnly && (
                  <td className="py-1 text-right">
                    <button type="button" className="text-red-600 underline" disabled={busy} onClick={() => remove(row)}>Remove</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!isReadOnly && state.status === 'ready' && (
        <form className="flex flex-wrap items-end gap-2" onSubmit={add}>
          <select aria-label="Pay item" className="input-field w-auto max-w-xs" value={draft.contractItemId}
            onChange={(e) => setDraft(d => ({ ...d, contractItemId: e.target.value }))}>
            <option value="">Pick a pay item…</option>
            {options.map(item => (
              <option key={item.contract_item_id} value={item.contract_item_id}>
                {item.item_no} ({item.budget_code}) — {item.description}
              </option>
            ))}
          </select>
          <input type="number" min="0" step="any" aria-label="Quantity" placeholder="Quantity" className="input-field w-28"
            value={draft.quantity} onChange={(e) => setDraft(d => ({ ...d, quantity: e.target.value }))} />
          <input type="text" aria-label="Note" placeholder="Note (optional)" maxLength={2000} className="input-field w-48"
            value={draft.note} onChange={(e) => setDraft(d => ({ ...d, note: e.target.value }))} />
          <button type="submit" className="btn-secondary" disabled={busy}>Add pay item</button>
        </form>
      )}
    </div>
  )
}
