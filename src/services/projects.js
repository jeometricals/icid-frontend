import { apiFetch } from './apiClient'

/**
 * Lists the projects the signed-in user is assigned to, once each ({project_id, project_name, borough, status,
 * user_role, roles}). roles is the list of project roles they hold there: any of 'inspector', 'oe', 're'.
 */
export async function getProjectsForUser() {
  const json = await apiFetch('/v1/projects/')
  return json.data
}

/**
 * Fetches one project's details ({project_id, project_name, project_description, registration_code, borough, status}).
 * Throws with error.status 404 when the project doesn't exist.
 */
export async function getProjectById(projectId) {
  const json = await apiFetch(`/v1/projects/${projectId}`)
  return json.data
}
