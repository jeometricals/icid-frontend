/**
 * The part of a page's router state that says which list opened the IDR: `from` ('drafts' | 'archive' | 'review')
 * and, for the archive, `archiveSearch` (the query string its filters were in). The IDR page and the pages under
 * it hand this on with every navigation between them, so Back still knows where to return.
 * Takes a location; returns {from, archiveSearch}, either undefined when not known.
 */
export function listOrigin(location) {
  const { from, archiveSearch } = location.state || {}
  return { from, archiveSearch }
}
