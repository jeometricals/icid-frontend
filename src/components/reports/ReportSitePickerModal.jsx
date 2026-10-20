import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import Modal from '../Modal'
import { getTaskOrder, importReportSite, listProperties, listReportSites, listTaskOrders } from '../../services/api'
import { reportTypeLabel } from '../../data/reportTypes'
import { KIND_FILTERS } from '../PropertyPickerModal'
import { siteLabel } from '../../lib/properties'
import { WORK_TYPES, reportName } from '../../lib/reportSites'

// Whether a property matches the search: its block, lot, CB or display_address (a sidewalk's address, a ped ramp's
// intersection) holds the text, any case
const matches = (property, text) => {
  const needle = text.trim().toLowerCase()
  return !needle || [property.block, property.lot, property.community_board, property.display_address]
    .some(value => value?.toLowerCase().includes(needle))
}

/**
 * Picks sites of the IDR's project to import into a report, with the work done there. Reads, when it opens, the
 * project's live sites, its task orders, and the sites every report of the IDR already imported: those rows are
 * disabled, titled "Already in {report name} on this IDR.". A search box (block, lot, CB, address or intersection),
 * kind chips and a task-order filter (the IDR's own to start, when it has one) narrow the rows. Import adds the ticked
 * sites one at a time, all with the work chosen, and stops at the first refusal.
 * Props: idr (with project_id and task_order_id), report (this report's row), reports (every report of the IDR),
 * onClose, onDone({added, failed}) — added the sites imported (as the backend returned them), failed {property,
 * message} for the refusal that stopped it, or null.
 */
export default function ReportSitePickerModal({ idr, report, reports, onClose, onDone }) {
  const [properties, setProperties] = useState([])
  const [taskOrders, setTaskOrders] = useState([])
  const [importedIn, setImportedIn] = useState(() => new Map()) // property id → the name of the report holding it
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('all')
  const [taskOrderId, setTaskOrderId] = useState(idr.task_order_id ?? '')
  const [taskOrderSites, setTaskOrderSites] = useState(null) // the chosen task order's property ids, null for all
  const [workType, setWorkType] = useState('concrete')
  const [workTypeOther, setWorkTypeOther] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [progress, setProgress] = useState(null) // while importing: how many have gone in

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setLoadError(null)
    const takesSites = reports.filter(r => r.report_type !== 'DSP')
    Promise.all([
      listProperties(idr.project_id),
      listTaskOrders(idr.project_id),
      Promise.all(takesSites.map(r => listReportSites(idr.idr_id, r.report_id).then(sites => [r, sites]))),
    ])
      .then(([found, orders, perReport]) => {
        if (ignore) return
        setProperties(found)
        setTaskOrders(orders)
        setImportedIn(new Map(perReport.flatMap(([r, sites]) =>
          sites.map(site => [site.property_id, reportName(r, reportTypeLabel(r.report_type))]))))
      })
      .catch(err => { if (!ignore) setLoadError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [idr, reports, attempt])

  useEffect(() => {
    let ignore = false
    if (!taskOrderId) {
      setTaskOrderSites(null)
      return undefined
    }
    getTaskOrder(taskOrderId)
      .then(order => { if (!ignore) setTaskOrderSites(new Set(order.properties.map(p => p.id))) })
      .catch(err => { if (!ignore) setLoadError(err.message) })
    return () => { ignore = true }
  }, [taskOrderId])

  const shown = useMemo(
    () => properties.filter(property => (kind === 'all' || property.kind === kind)
      && (!taskOrderSites || taskOrderSites.has(property.id)) && matches(property, search)),
    [properties, kind, taskOrderSites, search],
  )
  const busy = progress !== null
  const needsText = workType === 'other' && !workTypeOther.trim()

  const toggle = (id) => setSelected(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  // One at a time, so a refusal stops the batch with everything before it in and nothing after it tried
  const add = async () => {
    const picked = properties.filter(property => selected.has(property.id))
    const added = []
    setProgress(0)
    for (const property of picked) {
      try {
        added.push(await importReportSite(idr.idr_id, report.report_id, {
          property_id: property.id, work_type: workType, work_type_other: workType === 'other' ? workTypeOther.trim() : null,
        }))
      } catch (err) {
        onDone({ added, failed: { property, message: err.message } })
        return
      }
      setProgress(added.length)
    }
    onDone({ added, failed: null })
  }

  return (
    <Modal
      title="Import sites"
      onClose={onClose}
      busy={busy}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="button" onClick={add} disabled={busy || selected.size === 0 || needsText} className="btn-primary">
            {busy ? `Importing ${progress} of ${selected.size}...` : selected.size > 0 ? `Import ${selected.size} ${selected.size === 1 ? 'site' : 'sites'}` : 'Import'}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <div role="status" className="animate-spin rounded-full h-10 w-10 border-b-2 border-construction-600"></div>
        </div>
      ) : loadError ? (
        <div className="text-center py-4">
          <p className="text-red-600 mb-4">Couldn't load the project's sites: {loadError}</p>
          <button type="button" onClick={() => setAttempt(a => a + 1)} className="btn-primary">Retry</button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="site-picker-work" className="input-label">Work done</label>
              <select id="site-picker-work" className="input-field" value={workType} disabled={busy}
                onChange={(e) => setWorkType(e.target.value)}>
                {WORK_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            {workType === 'other' && (
              <div className="flex-1 min-w-[12rem]">
                <label htmlFor="site-picker-other" className="input-label">Specify</label>
                <input id="site-picker-other" type="text" maxLength={200} className="input-field" value={workTypeOther}
                  disabled={busy} onChange={(e) => setWorkTypeOther(e.target.value)} />
              </div>
            )}
            <div>
              <label htmlFor="site-picker-task-order" className="input-label">Task order</label>
              <select id="site-picker-task-order" className="input-field" value={taskOrderId} disabled={busy}
                onChange={(e) => setTaskOrderId(e.target.value)}>
                <option value="">All task orders</option>
                {taskOrders.map(order => <option key={order.id} value={order.id}>{order.task_order_number}</option>)}
              </select>
            </div>
          </div>

          <div className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="search"
              aria-label="Search by address or intersection"
              placeholder="Search by address, intersection, block or lot"
              className="input-field pl-9"
              value={search}
              disabled={busy}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div role="group" aria-label="Site kind" className="flex flex-wrap gap-2">
            {KIND_FILTERS.map(filter => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={kind === filter.value}
                onClick={() => setKind(filter.value)}
                disabled={busy}
                className={`rounded-full border px-3 py-1 text-sm font-medium ${kind === filter.value
                  ? 'border-construction-600 bg-construction-600 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="text-gray-600 py-4 text-center">
              {search.trim() ? `No sites match "${search.trim()}".` : 'No sites to show.'}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-gray-200 border border-gray-200 rounded-md">
              {shown.map(property => {
                const holder = importedIn.get(property.id)
                return (
                  <li key={property.id} title={holder ? `Already in ${holder} on this IDR.` : undefined}>
                    <label className={`flex items-center gap-3 px-3 py-2 text-sm ${holder ? 'text-gray-400' : 'hover:bg-gray-50 cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={selected.has(property.id)}
                        disabled={busy || Boolean(holder)}
                        onChange={() => toggle(property.id)}
                      />
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${property.kind === 'ped_ramp' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
                        {property.kind === 'ped_ramp' ? 'PR' : 'SW'}
                      </span>
                      <span className="flex-1 font-medium">{property.display_address}</span>
                      {property.kind !== 'ped_ramp' && <span className="whitespace-nowrap text-gray-500">{siteLabel(property)}</span>}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </Modal>
  )
}
