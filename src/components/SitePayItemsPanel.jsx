import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useProjectRoles } from '../contexts/ProjectRolesContext'
import { getContractItems, getIdr, getIdrFlags, getIdrSegments, listReportSites } from '../services/api'
import { readIdrContext, siteGeometryRows } from '../lib/idrSiteContext'
import { canChangeIdrFlags, countOf } from '../lib/idrFlags'
import { formatPayItemQuantity } from '../lib/payItemFormat'
import SitePayItemsEditor from './reports/SitePayItemsEditor'

/**
 * A site's pay items for the IDR it was opened from (Slice W3), on its PIR workspace (sidewalk) or its site page (ped
 * ramp), titled "Pay items (this IDR: IDR-005)". Shown only with `?idrId=&reportId=` (lib/idrSiteContext.js); without
 * them it renders nothing. First, read-only, what the site's flags and curb segments come to for that IDR, per pay item
 * (attributed, or claimed once approved); then the pay items entered by hand on the site (SitePayItemsEditor), which
 * the IDR's inspector edits on a draft, the stage's reviewer in review and an admin either way (canChangeIdrFlags, the
 * backend's rule); nobody once it is approved. Props: projectId, propertyId, onChanged() after a hand-entered change.
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
          geometryError: geometryFailed?.reason?.message ?? null,
        })
      })
      .catch(err => { if (!ignore) setState({ status: 'error', error: err.message }) })
    return () => { ignore = true }
  }, [idrId, reportId, projectId, propertyId])

  if (!context) return null

  const idr = state.idr
  const heading = `Pay items (this IDR: ${idr ? idr.idr_number ?? 'Draft' : '…'})`
  const canEdit = idr ? canChangeIdrFlags(idr, user, rolesByProject?.[projectId] ?? []) : false

  return (
    <section aria-labelledby="site-pay-items-heading" className="bg-white rounded-lg shadow-sm p-6 mt-6">
      <h3 id="site-pay-items-heading" className="text-lg font-semibold text-gray-900 mb-1">{heading}</h3>
      <p className="text-sm text-gray-600 mb-3">
        What this site adds to the IDR's pay items: its PIR flags and curb segments, and the pay items entered on it.
      </p>
      {state.status === 'loading' ? (
        <p className="text-sm text-gray-500">Loading pay items…</p>
      ) : state.status === 'error' ? (
        <p className="text-sm text-red-600">Couldn't load this IDR's pay items: {state.error}</p>
      ) : !state.site ? (
        <p className="text-sm text-gray-500">This site isn't imported into that report.</p>
      ) : (
        <>
          <h4 className="text-sm font-semibold text-gray-800 mb-1">From its flags and curb segments</h4>
          {state.geometryError ? (
            <p className="text-sm text-red-600 mb-3">Couldn't load its flags and curb segments: {state.geometryError}</p>
          ) : state.geometry.length === 0 ? (
            <p className="text-sm text-gray-500 mb-3">Its flags and curb segments add to no pay item.</p>
          ) : (
            <table className="min-w-full text-sm mb-4" aria-label="From its flags and curb segments">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-1 pr-3">Item</th>
                  <th className="py-1 pr-3">Description</th>
                  <th className="py-1 pr-3 text-right">Quantity</th>
                  <th className="py-1">From</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {state.geometry.map(row => (
                  <tr key={row.key}>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {row.pay_item_ref} <span className="text-gray-500">({row.budget_code})</span>
                    </td>
                    <td className="py-2 pr-3">{row.description}</td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">{formatPayItemQuantity(row.amount)} {row.unit}</td>
                    <td className="py-2 text-gray-600">
                      {[row.flags && countOf(row.flags, 'flag'), row.segments && countOf(row.segments, 'segment')]
                        .filter(Boolean).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <h4 className="text-sm font-semibold text-gray-800 mb-1">Entered on the site</h4>
          <SitePayItemsEditor idrId={idrId} reportId={reportId} site={state.site} contractItems={state.contractItems}
            isReadOnly={!canEdit} onChanged={onChanged} />
        </>
      )}
    </section>
  )
}
