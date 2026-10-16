import { apiFetchFile } from './apiClient'
import { saveFile } from './exports'

// The Construction Report (R1h): a property's as-built sheet for an approved IDR, DOT form 5/95, as a PDF the backend
// draws; and an approved IDR's reports, one PDF per property it claimed flags on, in a ZIP. For anyone on the
// project, demo users included. The backend answers 404 when no approved IDR covers the property's flags (or the IDR
// isn't approved, or claimed none) and 422 when a sketch can't go on one sheet.

// The backend's 422 for a sketch too large for one sheet (or on more than one page), word for word
export const SKETCH_TOO_LARGE_MESSAGE =
  "This property's sketch is too large to render on a single sheet. Multi-sheet support ships in R1h.1."

/**
 * Downloads a property's Construction Report: of the given IDR, or by default the most recently approved one that
 * claimed a flag on it. Returns the file name. Throws apiFetch's error (error.status 404, 422, ...).
 */
export async function downloadConstructionReport(propertyId, idrId) {
  const query = idrId ? `?idr_id=${encodeURIComponent(idrId)}` : ''
  return saveFile(await apiFetchFile(`/v1/properties/${propertyId}/construction-report${query}`,
    'construction_report.pdf'))
}

/**
 * Downloads an approved IDR's Construction Reports, one PDF per property, as a ZIP. Returns the file name. Throws
 * apiFetch's error (error.status 404 for an IDR that isn't approved or claimed no flags, 422 naming a property whose
 * sketch won't fit).
 */
export async function downloadConstructionReportZip(idrId) {
  return saveFile(await apiFetchFile(`/v1/idrs/${idrId}/construction-reports`, 'construction_reports.zip'))
}
