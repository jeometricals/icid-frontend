import { Fragment, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import ConfirmDialog from '../ConfirmDialog'
import ReportSitePickerModal from './ReportSitePickerModal'
import SitePayItemsEditor from './SitePayItemsEditor'
import DisclosureToggle from './DisclosureToggle'
import { removeReportSite, updateReportSite } from '../../services/api'
import { WORK_TYPES } from '../../lib/reportSites'

/**
 * The "Imported sites" card of a report (Slice U2): the sites whose PIR flags and curb segments this IDR covers, each
 * with the work done there. On a draft, Import sites opens the picker, the work can be changed (Other asks to specify)
 * and a site removed; otherwise the table is read-only. Each site links to its page, with ?returnTo= this report.
 * Each site's "Pay items (N)" opens its pay items entered by hand (Slice V1) beneath it.
 * Props: form (useReportForm's: idr, reports, report, idrId, projectId, reportId, isReadOnly, contractItems), sites
 * (from useReportSites), onImported(added) after the picker imported some, onChanged(site) after a change,
 * onRemoved(siteId), payItemCounts (site id → how many pay items it has) and onPayItemsChanged() after one changes.
 */
export default function ImportedSitesSection({ form, sites, onImported, onChanged, onRemoved, payItemCounts = {}, onPayItemsChanged }) {
  const location = useLocation()
  const { idrId, projectId, reportId, isReadOnly } = form
  const [picking, setPicking] = useState(false)
  const [notice, setNotice] = useState(null) // {tone: 'error' | 'ok', text}
  const [otherDraft, setOtherDraft] = useState({}) // site id → the Specify text being typed
  const [removing, setRemoving] = useState(null) // the site whose removal is being confirmed
  const [busy, setBusy] = useState(false)
  const [removeError, setRemoveError] = useState(null)
  const [openSite, setOpenSite] = useState(null) // the site whose pay items are open
  const returnTo = encodeURIComponent(`${location.pathname}${location.search}`)

  const change = async (site, workType, workTypeOther) => {
    if (workType === 'other' && !workTypeOther?.trim()) {
      // Wait for the text before saving 'other'
      setOtherDraft(d => ({ ...d, [site.id]: workTypeOther ?? '' }))
      return
    }
    try {
      onChanged(await updateReportSite(idrId, reportId, site.id, { work_type: workType, work_type_other: workTypeOther ?? null }))
      setOtherDraft(d => { const next = { ...d }; delete next[site.id]; return next })
      setNotice(null)
    } catch (err) {
      setNotice({ tone: 'error', text: `Couldn't change the work at ${site.display_address}: ${err.message}` })
    }
  }

  const remove = async () => {
    setBusy(true)
    setRemoveError(null)
    try {
      await removeReportSite(idrId, reportId, removing.id)
      onRemoved(removing.id)
      setRemoving(null)
    } catch (err) {
      setRemoveError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const done = ({ added, failed }) => {
    setPicking(false)
    if (added.length) onImported(added)
    setNotice(failed
      ? { tone: 'error', text: `${added.length ? `Imported ${added.length}; then ` : ''}${failed.property.display_address} wasn't imported: ${failed.message}` }
      : { tone: 'ok', text: `Imported ${added.length} ${added.length === 1 ? 'site' : 'sites'}.` })
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="form-section">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="form-section-title mb-0">Imported sites</h3>
          {!isReadOnly && (
            <button type="button" className="btn-secondary" onClick={() => setPicking(true)} disabled={!form.idr}>
              Import sites
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-3">
          The PIR flags and curb segments on these sites are this IDR's, claimed when it is approved.
        </p>
        {notice && (
          <p role={notice.tone === 'error' ? 'alert' : 'status'}
            className={`mb-3 text-sm ${notice.tone === 'error' ? 'text-red-600' : 'text-green-700'}`}>{notice.text}</p>
        )}
        {sites.status === 'loading' ? (
          <p className="text-sm text-gray-500">Loading sites…</p>
        ) : sites.status === 'error' ? (
          <p className="text-sm text-red-600">Couldn't load the imported sites: {sites.error}</p>
        ) : sites.rows.length === 0 ? (
          <p className="text-sm text-gray-500">No sites imported yet.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="py-1 pr-3">Kind</th>
                <th className="py-1 pr-3">Site</th>
                <th className="py-1 pr-3">Work</th>
                <th className="py-1 pr-3">Pay items</th>
                {!isReadOnly && <th className="py-1"><span className="sr-only">Remove</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sites.rows.map(site => {
                const typing = otherDraft[site.id]
                const workType = typing !== undefined ? 'other' : site.work_type
                const label = WORK_TYPES.find(type => type.value === site.work_type)?.label
                const count = payItemCounts[site.id] ?? 0
                return (
                  <Fragment key={site.id}>
                  <tr>
                    <td className="py-2 pr-3">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${site.kind === 'ped_ramp' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
                        {site.kind === 'ped_ramp' ? 'PR' : 'SW'}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <Link className="text-construction-700 underline" to={`/project/${projectId}/properties/${site.property_id}?returnTo=${returnTo}`}>
                        {site.display_address}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      {isReadOnly ? (
                        site.work_type === 'other' ? site.work_type_other : label
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <select aria-label={`Work at ${site.display_address}`} className="input-field w-auto" value={workType}
                            onChange={(e) => change(site, e.target.value, e.target.value === 'other' ? '' : null)}>
                            {WORK_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                          </select>
                          {workType === 'other' && (
                            <input
                              type="text"
                              aria-label={`Specify the work at ${site.display_address}`}
                              placeholder="Specify"
                              maxLength={200}
                              className="input-field w-auto"
                              defaultValue={typing ?? site.work_type_other ?? ''}
                              onBlur={(e) => {
                                const text = e.target.value.trim()
                                if (text && text !== site.work_type_other) change(site, 'other', text)
                              }}
                            />
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <DisclosureToggle expanded={openSite === site.id}
                        onToggle={() => setOpenSite(id => (id === site.id ? null : site.id))}>
                        Pay items ({count})
                      </DisclosureToggle>
                    </td>
                    {!isReadOnly && (
                      <td className="py-2 text-right">
                        <button type="button" className="text-red-600 underline" onClick={() => setRemoving(site)}>Remove</button>
                      </td>
                    )}
                  </tr>
                  {openSite === site.id && (
                    <tr>
                      <td colSpan={isReadOnly ? 4 : 5} className="pb-3">
                        <SitePayItemsEditor idrId={idrId} reportId={reportId} site={site} contractItems={form.contractItems}
                          isReadOnly={isReadOnly} onChanged={onPayItemsChanged} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {picking && (
        <ReportSitePickerModal idr={form.idr} report={form.report ?? { report_id: reportId }} reports={form.reports}
          onClose={() => setPicking(false)} onDone={done} />
      )}
      {removing && (
        <ConfirmDialog
          title="Remove site"
          message={`Remove ${removing.display_address} from this report?`}
          note="Its PIR flags and curb segments leave this IDR. The description isn't changed: regenerate it if it should be."
          confirmLabel="Remove"
          cancelLabel="Cancel"
          onConfirm={remove}
          onCancel={() => { setRemoving(null); setRemoveError(null) }}
          busy={busy}
          error={removeError}
        />
      )}
    </div>
  )
}
