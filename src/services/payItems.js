import { apiFetch } from './apiClient'

// Admin only, all of them: anyone else gets a 403, and an unknown project a 404.
// A pay item is {pay_item_uuid, pay_item_ref, description, unit, quantity, unit_price, budget_code, spec_section}.

/**
 * Lists every pay item of a project, by budget code then pay item ref. projectId is the project's text id
 * (e.g. 'HWS0023'). Returns [] for a project with none.
 */
export async function listProjectPayItems(projectId) {
  const json = await apiFetch(`/v1/admin/projects/${projectId}/pay-items`)
  return json.data
}

/**
 * Adds a pay item to a project and returns it. Takes {pay_item_ref, description, unit, quantity, unit_price,
 * budget_code}. The backend trims the text, puts the unit in capitals, and answers 400 for a value that doesn't
 * fit and 409 when the project already has that ref under that budget code (the thrown error's body then carries
 * existing_pay_item_uuid).
 */
export async function createProjectPayItem(projectId, body) {
  const json = await apiFetch(`/v1/admin/projects/${projectId}/pay-items`, {
    method: 'POST', body,
  })
  return json.data
}

/**
 * Changes some or all of a pay item's fields and returns the item as it now is. A field left out keeps its
 * value. The backend answers 400 for a value that doesn't fit or when nothing is sent, 404 for an item the
 * project doesn't have, and 409 as createProjectPayItem does.
 */
export async function updateProjectPayItem(projectId, payItemUuid, body) {
  const json = await apiFetch(`/v1/admin/projects/${projectId}/pay-items/${payItemUuid}`, {
    method: 'PATCH', body,
  })
  return json.data
}

/**
 * Deletes one pay item of a project. Returns nothing. Reports that already use the item keep their copy of it.
 * The backend answers 404 for an item the project doesn't have.
 */
export async function deleteProjectPayItem(projectId, payItemUuid) {
  await apiFetch(`/v1/admin/projects/${projectId}/pay-items/${payItemUuid}`, {
    method: 'DELETE',
  })
}

/**
 * Deletes every pay item of a project. Returns {deleted_count}. Reports that already use the items keep their
 * copies of them.
 */
export async function clearProjectPayItems(projectId) {
  const json = await apiFetch(`/v1/admin/projects/${projectId}/pay-items`, {
    method: 'DELETE',
  })
  return json.data
}

/**
 * Shows what importing a CSV of pay items would do, writing nothing. Takes the project's id and the File.
 * Returns {parsed_rows, new_count, overwrite_count, error_count, ignored_columns, new, overwrites, errors}, the
 * three lists in file order: a new row is a pay item's values with its row number; an overwrite is {row,
 * pay_item_ref, budget_code, existing, incoming}; an error is {row, reason, raw} (raw: the row's cells as typed).
 * The backend answers 400 for a file that can't be read as a pay-item CSV and 413 for one over 2 MB.
 */
export async function previewPayItemImport(projectId, file) {
  const form = new FormData()
  form.append('file', file)
  const json = await apiFetch(
    `/v1/admin/projects/${projectId}/pay-items/import/preview`,
    { method: 'POST', body: form },  // apiFetch skips JSON serialization for FormData
  )
  return json.data
}

/**
 * Imports a CSV of pay items: new ones are added, and those the project already has under the same ref and
 * budget code are overwritten. Takes the project's id and the File. Returns {inserted, updated}. The backend reads
 * and checks the file again: it answers 400, writing nothing, for a file it can't read, one with no rows, or one
 * with a row in error (the thrown error's body then carries error_count and errors).
 */
export async function commitPayItemImport(projectId, file) {
  const form = new FormData()
  form.append('file', file)
  const json = await apiFetch(
    `/v1/admin/projects/${projectId}/pay-items/import/commit`,
    { method: 'POST', body: form },
  )
  return json.data
}
