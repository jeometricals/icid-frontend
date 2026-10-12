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

/**
 * Admin only: lists every project, whoever is assigned to it, by project id, each as getProjectById returns one
 * ({project_id, project_name, project_description, registration_code, borough, status}). Anyone else gets a 403.
 */
export async function listAdminProjects() {
  const json = await apiFetch('/v1/admin/projects')
  return json.data
}

/**
 * Admin only: creates a project and returns it. registration_code is optional (blank is none). The project has
 * no status and nobody on it until an admin gives someone a role there. The backend answers 400 for a value that
 * doesn't fit (a project_id takes letters, digits, hyphens and underscores only) and 409 when the project_id is
 * taken (the thrown error's body then carries existing_project_id).
 */
export async function createAdminProject({ project_id, project_name, project_description, borough, registration_code }) {
  const json = await apiFetch('/v1/admin/projects', {
    method: 'POST',
    body: { project_id, project_name, project_description, borough, registration_code: registration_code || null },
  })
  return json.data
}

/**
 * Lists who holds which role on a project, one entry per user and role
 * ({user_uuid, email, first_name, last_name, role, assigned_at}). Admins only: anyone else gets a 403.
 * Returns {members, message}.
 */
export async function getProjectRoles(projectId) {
  const json = await apiFetch(`/v1/projects/${projectId}/roles`)
  return { members: json.data, message: json.message }
}

/**
 * Gives a user a role on a project (action 'grant') or takes it away ('revoke'). role is 'inspector', 'oe' or 're'.
 * Admins only. Safe to repeat: granting a role already held, or revoking one not held, succeeds and changes nothing.
 * Returns {members, message}: the project's roles as they now stand, and what the change did (e.g. "Role granted").
 */
export async function changeProjectRole(projectId, { userUuid, role, action }) {
  const body = { user_uuid: userUuid, role, action }
  const json = await apiFetch(`/v1/projects/${projectId}/roles`, { method: 'POST', body })
  return { members: json.data, message: json.message }
}
