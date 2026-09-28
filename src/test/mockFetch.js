import { vi } from 'vitest'

/**
 * Fetch mocks shared by the service tests. Each helper replaces global.fetch;
 * fetchUrl/fetchInit read back the first call's URL and init object.
 */

// A response whose body is `text`; apiFetch reads bodies with text() and parses them itself
function textResponse(status, text) {
  return { ok: status >= 200 && status < 300, status, text: () => Promise.resolve(text) }
}

export function mockFetch(status, body) {
  global.fetch = vi.fn().mockResolvedValue(textResponse(status, JSON.stringify(body)))
}

// A 204 No Content response, with the empty body a real one has
export function mockFetchNoContent() {
  global.fetch = vi.fn().mockResolvedValue(textResponse(204, ''))
}

// A response whose body isn't JSON, e.g. an HTML error page from a proxy
export function mockFetchText(status, text) {
  global.fetch = vi.fn().mockResolvedValue(textResponse(status, text))
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

// Answers successive fetch calls with each [status, body] in turn; an undefined body makes an empty (204-style) response
export function mockFetchSequence(responses) {
  global.fetch = vi.fn()
  for (const [status, body] of responses) {
    global.fetch.mockResolvedValueOnce(textResponse(status, body === undefined ? '' : JSON.stringify(body)))
  }
}
