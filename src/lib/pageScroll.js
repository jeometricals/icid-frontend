// Scrolling the workspace's page stack (Slice Y4b): the window scrolls; a caption click eases there over 300 ms.

export const SMOOTH_SCROLL_MS = 300

// Ease in and out: slow start, slow finish
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

/**
 * Scrolls the window to a vertical position: at once, or eased over `ms` (requestAnimationFrame). A user who prefers
 * reduced motion gets it at once.
 * Returns a promise that settles when it is there.
 */
export function scrollWindowTo(top, { smooth = false, ms = SMOOTH_SCROLL_MS } = {}) {
  const target = Math.max(0, Math.round(top))
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!smooth || reduce || typeof window.requestAnimationFrame !== 'function') {
    window.scrollTo(0, target)
    return Promise.resolve()
  }
  const start = window.scrollY
  const began = performance.now()
  return new Promise(resolve => {
    const step = (now) => {
      const t = Math.min(1, (now - began) / ms)
      window.scrollTo(0, start + (target - start) * ease(t))
      if (t < 1) window.requestAnimationFrame(step)
      else resolve()
    }
    window.requestAnimationFrame(step)
  })
}

/** Where the window scrolls to put an element's top just under the sticky toolbar (offset px). */
export const topOf = (element, offset = 0) => element.getBoundingClientRect().top + window.scrollY - offset

/** Where the window scrolls to put an element's middle in the middle of the viewport. */
export function centreOf(element) {
  const box = element.getBoundingClientRect()
  return box.top + window.scrollY + box.height / 2 - window.innerHeight / 2
}
