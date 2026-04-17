const BASE_URL = import.meta.env.VITE_API_URL || 'https://icid-backend.vercel.app'

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `API error ${res.status}`)
  }
  return res.json()
}

export async function getProjectsForUser(userId) {
  const json = await apiFetch(`/v1/projects/?user_id=${userId}`)
  return json.data
}

export async function getProjectById(projectId) {
  const json = await apiFetch(`/v1/projects/${projectId}`)
  return json.data
}
