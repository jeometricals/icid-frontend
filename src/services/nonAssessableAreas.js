import { apiFetch } from './apiClient'

// A flag's non-assessable areas: the parts of it that are not assessed (a driveway, grass, ...). An area is
// {non_assessable_area_id, flag_id, pir_page_id, pir_id, property_id, project_id, display_order, shape, dimensions,
// sketch_x, sketch_y, rotation, reason, computed_quantity, created_at, updated_at, created_by, deleted_at,
// deleted_by}; its shape and place are a flag's (feet, and native page pixels). Reading is for anyone on the project.

/**
 * Lists a flag's live non-assessable areas, by display order. There is no list per PIR: a flag carries
 * non_assessable_areas_count, so only a flag that has some needs asking. The backend answers 403 for a user who
 * isn't on the project and 404 for an unknown flag.
 */
export async function listFlagNonAssessableAreas(flagId) {
  const json = await apiFetch(`/v1/flags/${flagId}/non-assessable-areas`)
  return json.data
}
