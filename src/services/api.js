import { apiFetch } from './apiClient'

// Components import every backend call from here; IDR calls live in their own files.
export * from './idrs'
export * from './idrReports'

export async function getProjectsForUser(userId) {
  const json = await apiFetch(`/v1/projects/?user_id=${userId}`)
  return json.data
}

export async function getProjectById(projectId) {
  const json = await apiFetch(`/v1/projects/${projectId}`)
  return json.data
}

// ---------------------------------------------------------------------------
// Removed report-level calls. The /v1/reports/* endpoints no longer exist on the backend.
// These stubs only keep old imports resolvable so the dev server still loads until the pages
// are rewired; each rejects so callers show their error state. Delete in R3 Pass 4.
// ---------------------------------------------------------------------------

function removedCall(name) {
  return Promise.reject(new Error(`${name} was removed in the IDR refactor (R3)`))
}

export const createReport = () => removedCall('createReport')
export const saveGeneralForm = () => removedCall('saveGeneralForm')
export const getReport = () => removedCall('getReport')
export const listReports = () => removedCall('listReports')
export const submitReport = () => removedCall('submitReport')
