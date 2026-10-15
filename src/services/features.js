import { apiFetch } from './apiClient'

// A PIR page's features: point obstructions and sized features (hydrants, tree pits, cellar doors, ...). A feature is
// {feature_id, pir_page_id, pir_id, property_id, project_id, flag_id, feature_type, area_impact ('marker_only',
// 'subtract' or 'sits_on_top'), sketch_x, sketch_y, rotation, shape (or null; a flag's shapes or 'circle'),
// dimensions, label, pay_item_id, computed_quantity, reported_quantity, quantity, created_at, updated_at,
// created_by, deleted_at, deleted_by}. sketch_x / sketch_y are in the page's native, unrotated pixels. Reading is
// for anyone on the project.

/**
 * Lists a PIR's live features on its live pages, by page and then in the order they were drawn. The backend
 * answers 403 for a user who isn't on the project and 404 for an unknown PIR.
 */
export async function listPirFeatures(pirId) {
  const json = await apiFetch(`/v1/pirs/${pirId}/features`)
  return json.data
}
