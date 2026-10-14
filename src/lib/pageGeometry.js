// A PIR page's geometry. Everything stored about a page (a flag's sketch_x / sketch_y) is in the page's native,
// unrotated pixel space: x to the right and y down from the top-left corner of the PNG as uploaded, 0..width_px and
// 0..height_px. A page's rotation_deg only changes how it is shown: the image and the sketch overlay are drawn in
// native space inside one box, and that box is turned with a CSS transform, so stored positions stay valid at
// every rotation.

/** Whether a rotation lays the page on its side, swapping its width and height on screen. */
export const isSideways = (rotation) => rotation === 90 || rotation === 270

/** The page's size on screen once rotated: {width, height} in its own pixels. */
export function rotatedSize({ width_px: width, height_px: height, rotation_deg: rotation }) {
  return isSideways(rotation) ? { width: height, height: width } : { width, height }
}

/**
 * Where a pointer is on a page, in its native unrotated pixels. Takes the pointer's client position ({clientX,
 * clientY}), the on-screen rectangle of RotatedPage's outer box (getBoundingClientRect) and the page (width_px,
 * height_px, rotation_deg). The outer box holds the rotated page at a uniform scale, centred, so the point is taken
 * relative to the box's centre, scaled back to page pixels and turned back by the page's rotation.
 * Returns {x, y}; a point off the page gives values outside 0..width_px / 0..height_px.
 */
export function toNativeCoords({ clientX, clientY }, rect, page) {
  const { width: shownWidth } = rotatedSize(page)
  const factor = rect.width / shownWidth // screen pixels per page pixel
  const dx = (clientX - (rect.left + rect.width / 2)) / factor
  const dy = (clientY - (rect.top + rect.height / 2)) / factor
  const turn = ((page.rotation_deg ?? 0) * Math.PI) / 180
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  // Undo the clockwise turn: rotate by -turn
  const x = dx * cos + dy * sin
  const y = -dx * sin + dy * cos
  return { x: x + page.width_px / 2, y: y + page.height_px / 2 }
}

/** The distance between two points, in the same units. */
export const distanceBetween = (a, b) => Math.hypot(b.x - a.x, b.y - a.y)
