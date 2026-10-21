import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useProjectRoles } from '../contexts/ProjectRolesContext'
import { getContractItems, getIdr, getIdrFlags, getIdrSegments, listReportSites } from '../services/api'
import { claimedElsewhereNote, readIdrContext, siteGeometryRows } from '../lib/idrSiteContext'
import { canChangeIdrFlags } from '../lib/idrFlags'
import SitePayItemsEditor from './reports/SitePayItemsEditor'

/**
 * A site's pay items for the IDR it was opened from (Slice W3; one table since Slice X), on its PIR workspace (sidewalk)
 * or its site page (ped ramp), titled "Pay items for this site" under "This IDR: IDR-005". Shown only with
 * `?idrId=&reportId=` (lib/idrSiteContext.js); without them it renders nothing. One table (SitePayItemsEditor): the auto
 * rows, what the site's flags and curb segments come to for that IDR per pay item (attributed, or claimed once
 * approved), read-only; then the pay items entered by hand on the site, which the IDR's inspector edits on a draft, the
 * stage's reviewer in review and an admin either way (canChangeIdrFlags, the backend's rule); nobody once it is
 * approved. Above it, what another IDR already billed here (claimedElsewhereNote). Props: projectId, propertyId,
 * onChanged() after a hand-entered change.
 */
export default function SitePayItemsPanel({ projectId, propertyId, onChanged }) {
  const context = readIdrContext(useLocation().search)
  const { user } = useAuth()
  const { rolesByProject } = useProjectRoles()
  const [state, setState] = useState({ status: 'loading', error: null })
  const idrId = context?.idrId
  const reportId = context?.reportId

  useEffect(() => {
    if (!idrId) return undefined
    let ignore = false
    setState({ status: 'loading', error: null })
    Promise.all([
      getIdr(idrId), listReportSites(idrId, reportId), getContractItems(projectId),
      Promise.allSettled([getIdrFlags(idrId), getIdrSegments(idrId)]),
    ])
      .then(([idr, sites, contractItems, [flags, segments]]) => {
        if (ignore) return
        const geometryFailed = [flags, segments].find(result => result.status === 'rejected')
        setState({
          status: 'ready', error: null, idr, contractItems,
          site: sites.find(site => site.property_id === propertyId) ?? null,
          geometry: geometryFailed ? null : siteGeometryRows(flags.value.flags, segments.value.segments, propertyId),
          elsewhere: geometryFailed ? null : claimedElsewhereNote(flags.value.flags, segments.value.segments, propertyId),
          geometryError: geometryFailed?.reason?.message ?? null,
        })
      })
      .catch(err => { if (!ignore) setState({ status: 'error', error: err.message }) })
    return () => { ignore = true }
  }, [idrId, reportId, projectId, propertyId])

  if (!context) return null

  const idr = state.idr
  const subtitle = `This IDR: ${idr ? idr.idr_number ?? 'Draft' : '…'}`
  const canEdit = idr ? canChangeIdrFlags(idr, user, rolesByProject?.[projectId] ?? []) : false

  return (
    <section aria-labelledby="site-pay-items-heading" className="bg-white rounded-lg shadow-sm p-6 mt-6">
      <h3 id="site-pay-items-heading" className="text-lg font-semibold text-gray-900">Pay items for this site</h3>
      <p className="text-sm text-gray-600 mb-3">{subtitle}</p>
      {state.status === 'loading' ? (
        <p className="text-sm text-gray-500">Loading pay items…</p>
      ) : state.status === 'error' ? (
        <p className="text-sm text-red-600">Couldn't load this IDR's pay items: {state.error}</p>
      ) : !state.site ? (
        <p className="text-sm text-gray-500">This site isn't imported into that report.</p>
      ) : (
        <>
          {state.geometryError && (
            <p className="text-sm text-red-600 mb-3">Couldn't load its flags and curb segments: {state.geometryError}</p>
          )}
          {state.elsewhere && <p className="text-sm text-gray-700 mb-3">{state.elsewhere}</p>}
          <SitePayItemsEditor idrId={idrId} reportId={reportId} site={state.site} contractItems={state.contractItems}
            autoRows={state.geometry ?? []} isReadOnly={!canEdit} onChanged={onChanged} />
        </>
      )}
    </section>
  )
}
