/**
 * `?returnTo=`: the IDR report page a site page or its PIR sketch workspace was opened from, so they can offer
 * "Back to report". Only a path inside this app's projects is honoured: it starts with `/project/`, and has no `//`
 * and no backslash (so it can never leave the app); anything else is ignored.
 */

const PARAM = 'returnTo'

/** Whether a value is a returnTo this app follows: a relative path starting with /project/. */
function isProjectPath(value) {
  return typeof value === 'string' && value.startsWith('/project/') && !value.includes('//') && !value.includes('\\')
}

/**
 * Reads returnTo from a query string ('?returnTo=...', with or without the '?') or a URLSearchParams.
 * Returns the path, or null when there is none or it isn't one to follow.
 */
export function readReturnTo(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? '')
  const value = params.get(PARAM)
  return isProjectPath(value) ? value : null
}

/**
 * Adds returnTo to a path (keeping its query string and any #hash), e.g. a site's page linked from an IDR report.
 * Returns the path unchanged when returnTo is empty or isn't one to follow.
 */
export function withReturnTo(path, returnTo) {
  if (!isProjectPath(returnTo)) return path
  const hashAt = path.indexOf('#')
  const base = hashAt === -1 ? path : path.slice(0, hashAt)
  const hash = hashAt === -1 ? '' : path.slice(hashAt)
  const queryAt = base.indexOf('?')
  const params = new URLSearchParams(queryAt === -1 ? '' : base.slice(queryAt + 1))
  params.set(PARAM, returnTo)
  return `${queryAt === -1 ? base : base.slice(0, queryAt)}?${params.toString()}${hash}`
}
