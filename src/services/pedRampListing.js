import { apiFetch } from './apiClient'

// A project's ped ramp inspections (Pedramp Phase 3, S5): one row per corner that has an inspection, {inspection_id,
// corner_id, corner_name ("3rd Ave & 38 Street"), corner_direction, ramp_count, status, inspector_uuid,
// inspector_name, re_uuid, re_name, approved_at, tif_count, has_dot_pdf}, approved newest first, 30 a page. The
// filters are the backend's: status, inspector, RE, the approval's day from / to (New York), has a TIF, and a search
// on the corner's streets or a ramp's Ramp ID. The approved ones' DOT PDFs come as signed URLs, never as bytes.

export const LISTING_PAGE_SIZE = 30

/** The filters as the backend names them, leaving out the ones not set. Takes {status, inspectorUuid, reUuid, from, to, hasTif, q}. */
function filterFields({ status, inspectorUuid, reUuid, from, to, hasTif, q } = {}) {
  const fields = { status, inspector_uuid: inspectorUuid, re_uuid: reUuid, from, to, has_tif: hasTif, q: q?.trim() }
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value))
}

/**
 * Lists a page of a project's ped ramp inspections. Takes the project's id and {status, inspectorUuid, reUuid, from,
 * to (YYYY-MM-DD), hasTif ('yes' | 'no'), q, page, pageSize}. Returns {total, page, page_size, rows}. The backend
 * answers 400 for a malformed date or from after to.
 */
export async function listPedRampInspections(projectId, { page = 1, pageSize = LISTING_PAGE_SIZE, ...filters } = {}) {
  const params = new URLSearchParams(filterFields(filters))
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  const json = await apiFetch(`/v1/projects/${encodeURIComponent(projectId)}/ped-ramp-inspections?${params}`)
  return json.data
}

/**
 * Zips the DOT PDFs of the approved inspections the filters leave (at most 100 corners; the backend's 400 says to
 * narrow them). Takes the project's id and the filters as listPedRampInspections takes them. Returns {url,
 * expires_at, corner_count, file_name}: a signed URL to the ZIP.
 */
export async function bulkDownloadPedRampInspections(projectId, filters = {}) {
  const json = await apiFetch(`/v1/projects/${encodeURIComponent(projectId)}/ped-ramp-inspections/bulk-download`, {
    method: 'POST', body: filterFields(filters),
  })
  return json.data
}

/** Signs a URL to an approved inspection's stored DOT PDF (or its ZIP with the TIFs). Returns {url, expires_at, file_name}. */
export async function getInspectionDotPdf(inspectionId) {
  const json = await apiFetch(`/v1/ped-ramp-inspections/${inspectionId}/dot-pdf`)
  return json.data
}
