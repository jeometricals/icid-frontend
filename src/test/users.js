/**
 * Users and sessions shared by the tests, shaped as the backend returns them
 * ({uuid, email, first_name, last_name, role, is_demo}).
 */
export const TEST_USER = {
  uuid: '7f3c2a9e-1b4d-4c8a-9e2f-3a5b6c7d8e90',
  email: 'KhanG@magnoleng.pc',
  first_name: 'Genghis',
  last_name: 'Khan',
  role: null,
  is_demo: false,
}
export const TEST_USER_ID = TEST_USER.uuid

export const DEMO_USER = {
  uuid: 'd0000000-0000-4000-8000-000000000004',
  email: 'demo-d0000000-0000-4000-8000-000000000004@icid.local',
  first_name: 'Demo',
  last_name: null,
  role: null,
  is_demo: true,
}

// What POST /v1/auth/login and POST /v1/auth/demo answer with
export function sessionFor(user, token = 'token-abc') {
  return { access_token: token, token_type: 'bearer', expires_in: 86400, user }
}
