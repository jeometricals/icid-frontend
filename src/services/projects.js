import { apiFetch } from './apiClient'

/**
 * Lists the projects a user is assigned to ({project_id, project_name, borough, status, user_role}).
 */
export async function getProjectsForUser(userId) {
  const json = await apiFetch(`/v1/projects/?user_id=${userId}`)
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
