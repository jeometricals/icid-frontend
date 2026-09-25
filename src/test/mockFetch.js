import { vi } from 'vitest'

/**
 * Fetch mocks shared by the service tests. Each helper replaces global.fetch;
 * fetchUrl/fetchInit read back the first call's URL and init object.
 */

export function mockFetch(status, body) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

// A 204 No Content response; json() rejects the way a real empty body would
export function mockFetchNoContent() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 204,
    json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
  })
}

export function mockFetchFailure(message) {
  global.fetch = vi.fn().mockRejectedValue(new Error(message))
}

export function fetchUrl() {
  return new URL(fetch.mock.calls[0][0])
}

export function fetchInit() {
  return fetch.mock.calls[0][1]
}
