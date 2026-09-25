import { apiFetch } from './apiClient'

// Components import every backend call from here; IDR and user calls live in their own files.
export * from './idrs'
export * from './idrReports'
export * from './users'

export async function getProjectsForUser(userId) {
  const json = await apiFetch(`/v1/projects/?user_id=${userId}`)
  return json.data
}

export async function getProjectById(projectId) {
  const json = await apiFetch(`/v1/projects/${projectId}`)
  return json.data
}

