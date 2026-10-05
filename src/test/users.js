/**
 * Users and sessions shared by the tests, shaped as the backend returns them
 * ({uuid, email, first_name, last_name, role, is_demo, has_signature, signature_set_at}).
 */
export const TEST_USER = {
  uuid: '7f3c2a9e-1b4d-4c8a-9e2f-3a5b6c7d8e90',
  email: 'KhanG@magnoleng.pc',
  first_name: 'Genghis',
  last_name: 'Khan',
  role: null,
  is_demo: false,
  has_signature: true,
  signature_set_at: '2026-10-01T13:00:00Z',
}
export const TEST_USER_ID = TEST_USER.uuid

// The same user before they set a signature
export const UNSIGNED_USER = { ...TEST_USER, has_signature: false, signature_set_at: null }

export const DEMO_USER = {
  uuid: 'd0000000-0000-4000-8000-000000000004',
  email: 'demo-d0000000-0000-4000-8000-000000000004@icid.local',
  first_name: 'Demo',
  last_name: null,
  role: null,
  is_demo: true,
  has_signature: false,
  signature_set_at: null,
}

// What POST /v1/auth/login and POST /v1/auth/demo answer with
export function sessionFor(user, token = 'token-abc') {
  return { access_token: token, token_type: 'bearer', expires_in: 86400, user }
}
