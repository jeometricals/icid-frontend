import { apiFetch } from './apiClient'

// Measurement bundles (Slices Y3b-2, Y4a): several abutting flags of one classification measured as one outline (1 to
// 3 rectangles the OE measured). A measurement is {measurement_id, pir_id, property_id, project_id, outer_shape,
// outer_dimensions ({rectangles: [{L, W}]}), outer_area, deductions ([{type, area_sf, source_flag_id, source_area_id |
// source_feature_id}]), needs_remeasure, pay_item_id, surveyed_thickness, surveyed_is_assessable, bundled, frozen (a
// member claimed by an approved IDR: its figures never change), claimed_by_idr_number, retired_at, created_at,
// created_by, created_by_name, updated_at, updated_by, members: [{flag_id, display_order, pir_page_id,
// area_share_fraction, computed_quantity, quantity, claimed_by_idr_id, deleted_at}]}. Every call is for an OE or RE on
// the project, or an admin (403 otherwise); never a demo user.

/** Reads one measurement, solo or a bundle. 404 for an unknown one. */
export async function getMeasurement(measurementId) {
  const json = await apiFetch(`/v1/measurements/${measurementId}`)
  return json.data
}

/**
 * Bundles a page's flags into one measurement of the outline measured: rectangles [{L, W}], 1 to 3. Returns the
 * bundle. 400 names a flag that can't be bundled (not live on the page, claimed, already in a bundle, of another
 * thickness, assessment or pay item, or not abutting the rest), 409 when they changed meanwhile.
 */
export async function bundleFlags(pirPageId, flagIds, rectangles) {
  const json = await apiFetch(`/v1/pir-pages/${pirPageId}/measurements/bundle`, {
    method: 'POST', body: { flag_ids: flagIds, outer_dimensions: { rectangles } },
  })
  return json.data
}

/**
 * Marks a bundle re-measured: {needs_remeasure: false}, and/or a new outline ({outer_dimensions: {rectangles}}), which
 * is the re-measurement and clears needs_remeasure too. Returns the bundle as it now is. 409 for a new outline on a
 * frozen bundle, 404 for a retired one.
 */
export async function updateMeasurement(measurementId, data) {
  const json = await apiFetch(`/v1/measurements/${measurementId}`, { method: 'PATCH', body: data })
  return json.data
}

/**
 * Breaks a bundle up: each member back to a measurement of its own. 409 for a frozen bundle, 404 for a retired one.
 */
export async function unbundleMeasurement(measurementId) {
  await apiFetch(`/v1/measurements/${measurementId}`, { method: 'DELETE' })
}
