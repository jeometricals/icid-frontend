import { apiFetch } from './apiClient'

// A property's work across IDRs (Slice V). The backend answers 403 for anyone not on the project and 404 for an
// unknown property.

/**
 * Lists every import of a property into a report (V2), newest work date first: {id, idr_id, report_id, report_type,
 * work_type, work_type_other, added_at, idr_number (null before acceptance), report_date ('YYYY-MM-DD'), status,
 * deleted_at, return_reason, reporter_uuid, reporter_name}. Deleted and returned IDRs are included.
 */
export async function getPropertyWorkHistory(propertyId) {
  const json = await apiFetch(`/v1/properties/${propertyId}/work-history`)
  return json.data
}
