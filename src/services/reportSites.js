import { apiFetch } from './apiClient'

// The sites a report imports (Slice U): properties of the IDR's project with the work done there. An IDR's PIR flags
// and curb segments are those on its imported sites, claimed when it is approved. A site is {id, report_id, idr_id,
// property_id, work_type ('excavation' | 'concrete' | 'pavement_restoration' | 'other'), work_type_other (the text for
// 'other', else null), added_at, added_by, kind, boro, address, block, lot, intersection_street_1,
// intersection_street_2, quadrant, facing_street, ramp_type, community_board, property_deleted_at, display_address}.
// Reading is for anyone who can read the IDR; changing for its inspector on a draft, the stage's reviewer in review, or
// an admin (403 otherwise, a demo user always; 409 once submitted and not yet accepted, approved or deleted).

const sitesUrl = (idrId, reportId) => `/v1/idrs/${idrId}/reports/${reportId}/sites`

/** Lists the sites a report imported, oldest first. The backend answers 404 for a report that isn't the IDR's. */
export async function listReportSites(idrId, reportId) {
  const json = await apiFetch(sitesUrl(idrId, reportId))
  return json.data
}

/**
 * Imports a site into a report and returns it. Takes {property_id, work_type, work_type_other}. The backend answers
 * 400 for a DSP or a site that isn't a live one of the project, 409 when the IDR already imported the site (the thrown
 * error's body then carries existing_report_id) or a report holds by hand a pay item the site's flags fill, and 422 for
 * 'other' work without its text.
 */
export async function importReportSite(idrId, reportId, data) {
  const json = await apiFetch(sitesUrl(idrId, reportId), { method: 'POST', body: data })
  return json.data
}

/** Changes the work done at an imported site, {work_type, work_type_other}, and returns the site. */
export async function updateReportSite(idrId, reportId, siteId, data) {
  const json = await apiFetch(`${sitesUrl(idrId, reportId)}/${siteId}`, { method: 'PATCH', body: data })
  return json.data
}

/** Removes a site from a report: its flags and curb segments leave the IDR. Resolves with nothing. */
export async function removeReportSite(idrId, reportId, siteId) {
  await apiFetch(`${sitesUrl(idrId, reportId)}/${siteId}`, { method: 'DELETE' })
}
