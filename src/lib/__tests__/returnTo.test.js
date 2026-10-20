import { describe, it, expect } from 'vitest'
import { readReturnTo, withReturnTo } from '../returnTo'

const REPORT = '/project/HWS0023/idr/idr-1/swcb/rep-1'

describe('readReturnTo', () => {
  it('reads a report page from a query string, with or without the ?', () => {
    expect(readReturnTo(`?returnTo=${encodeURIComponent(REPORT)}`)).toBe(REPORT)
    expect(readReturnTo(`returnTo=${encodeURIComponent(REPORT)}&page=2`)).toBe(REPORT)
  })

  it('reads from URLSearchParams', () => {
    expect(readReturnTo(new URLSearchParams({ returnTo: REPORT }))).toBe(REPORT)
  })

  it('keeps a query string inside the path', () => {
    const withQuery = `${REPORT}?tab=sites`
    expect(readReturnTo(`?returnTo=${encodeURIComponent(withQuery)}`)).toBe(withQuery)
  })

  it.each([
    ['none', ''],
    ['empty', '?returnTo='],
    ['another app', `?returnTo=${encodeURIComponent('https://evil.example/project/x')}`],
    ['protocol-relative', `?returnTo=${encodeURIComponent('//evil.example/project/x')}`],
    ['outside /project/', `?returnTo=${encodeURIComponent('/admin/users')}`],
    ['a double slash inside', `?returnTo=${encodeURIComponent('/project//evil.example')}`],
    ['a backslash', `?returnTo=${encodeURIComponent('/project/\\evil.example')}`],
    ['relative', `?returnTo=${encodeURIComponent('project/HWS0023')}`],
  ])('ignores %s', (_, search) => {
    expect(readReturnTo(search)).toBeNull()
  })

  it('ignores a missing search', () => {
    expect(readReturnTo(undefined)).toBeNull()
  })
})

describe('withReturnTo', () => {
  it('adds returnTo to a path without a query string', () => {
    const path = withReturnTo('/project/HWS0023/properties/p1', REPORT)
    expect(path).toBe(`/project/HWS0023/properties/p1?returnTo=${encodeURIComponent(REPORT)}`)
    expect(readReturnTo(path.slice(path.indexOf('?')))).toBe(REPORT)
  })

  it('keeps the query string and hash a path has', () => {
    const path = withReturnTo('/project/HWS0023/properties/p1/pir?page=2&flag=f1#top', REPORT)
    expect(path.startsWith('/project/HWS0023/properties/p1/pir?page=2&flag=f1&returnTo=')).toBe(true)
    expect(path.endsWith('#top')).toBe(true)
  })

  it('replaces a returnTo already there', () => {
    const path = withReturnTo(`/project/P/properties/p1?returnTo=${encodeURIComponent('/project/old')}`, REPORT)
    expect(new URLSearchParams(path.split('?')[1]).getAll('returnTo')).toEqual([REPORT])
  })

  it('leaves the path alone without a returnTo to follow', () => {
    expect(withReturnTo('/project/P/properties/p1', null)).toBe('/project/P/properties/p1')
    expect(withReturnTo('/project/P/properties/p1', 'https://evil.example')).toBe('/project/P/properties/p1')
  })
})
