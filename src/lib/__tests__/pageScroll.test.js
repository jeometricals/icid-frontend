import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SMOOTH_SCROLL_MS, centreOf, scrollWindowTo, topOf } from '../pageScroll'

const box = (top, height = 100) => ({ getBoundingClientRect: () => ({ top, height }) })

describe('page scrolling (Slice Y4b)', () => {
  let scrollTo
  beforeEach(() => {
    scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("puts an element's top under the toolbar, and its middle in the middle of the window", () => {
    expect(topOf(box(300), 60)).toBe(440)
    expect(centreOf(box(1000, 100))).toBe(1000 + 200 + 50 - 400)
  })

  it('jumps at once unless asked to ease, never above the top', async () => {
    await scrollWindowTo(-50)
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
    await scrollWindowTo(512.4)
    expect(scrollTo).toHaveBeenLastCalledWith(0, 512)
  })

  it(`eases there over ${SMOOTH_SCROLL_MS} ms, a frame at a time`, async () => {
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.stubGlobal('requestAnimationFrame', (step) => { now += 100; step(now); return 1 })
    await scrollWindowTo(1200, { smooth: true })
    const tops = scrollTo.mock.calls.map(call => call[1])
    expect(tops.length).toBe(3)
    expect(tops[0]).toBeGreaterThan(200)
    expect(tops[1]).toBeGreaterThan(tops[0])
    expect(tops.at(-1)).toBe(1200)
  })

  it('jumps at once for a user who prefers reduced motion', async () => {
    const raf = vi.fn()
    vi.stubGlobal('requestAnimationFrame', raf)
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    await scrollWindowTo(900, { smooth: true })
    expect(raf).not.toHaveBeenCalled()
    expect(scrollTo).toHaveBeenCalledWith(0, 900)
  })
})
