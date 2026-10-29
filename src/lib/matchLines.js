// Match lines in the workspace (Slice Y4b): a line pairs with the one carrying its label on another page (a label is on
// at most two pages of a PIR), as the Construction Report pairs them (R1h.1a's match_line_caption), with pages for
// sheets.

/** The line on another page carrying a line's label, or null. Takes the line and the PIR's lines. */
export function partnerOf(line, lines) {
  return lines.find(other => other.label === line.label && other.pir_page_id !== line.pir_page_id) ?? null
}

/**
 * A line's caption: MATCH LINE "A" — SEE PAGE 2, or MATCH LINE "A" when no other page carries its label.
 * Takes the line and its partner (partnerOf).
 */
export function matchLineCaption(line, partner) {
  return partner ? `MATCH LINE "${line.label}" — SEE PAGE ${partner.page_number}` : `MATCH LINE "${line.label}"`
}

// A caption's width, as a share of its font size per character (bold capitals), for keeping it on the page
const CHAR_WIDTH = 0.6

/**
 * Where a line's caption goes on its page (pilot sweep #2, as the Construction Report's caption_placement): along the
 * line, beside its middle. A line taller than it is wide as the page shows it (its rotation_deg applied) carries it
 * turned to read bottom to top, as drawings letter a vertical line; any other reads left to right along its slope. It
 * slides along the line to stay on the page, and is shrunk when the page is shorter than it along the line.
 * Takes the line ({x1, y1, x2, y2}, native page pixels), the caption, the page ({width_px, height_px, rotation_deg}),
 * its font size and how far beside the line its middle sits.
 * Returns {x, y, angle, fontSize}: its middle in native pixels, and the angle (degrees clockwise, in the page's native
 * space, so the page's own turn brings it upright) to rotate it about that middle.
 */
export function captionPlacement(line, caption, page, fontSize, offset) {
  const turn = ((page.rotation_deg ?? 0) * Math.PI) / 180
  const dx = line.x2 - line.x1
  const dy = line.y2 - line.y1
  // The line as the page shows it (turned clockwise, y down)
  const screenX = dx * Math.cos(turn) - dy * Math.sin(turn)
  const screenY = dx * Math.sin(turn) + dy * Math.cos(turn)
  const vertical = Math.abs(screenY) > Math.abs(screenX)
  // Point it up the screen (a vertical line) or right (any other), so the caption reads bottom to top, or left to right
  const flip = vertical ? screenY > 0 : screenX < 0
  const screenAngle = Math.atan2(flip ? -screenY : screenY, flip ? -screenX : screenX)
  const angle = screenAngle - turn
  const along = { x: Math.cos(angle), y: Math.sin(angle) }
  const up = { x: Math.sin(angle), y: -Math.cos(angle) }
  const width = page.width_px ?? 0
  const height = page.height_px ?? 0
  // The page's length along the line, and the caption shrunk to fit it
  const room = Math.min(
    Math.abs(along.x) > 1e-9 ? width / Math.abs(along.x) : Infinity,
    Math.abs(along.y) > 1e-9 ? height / Math.abs(along.y) : Infinity,
  )
  const size = Math.min(fontSize, (room * 0.95) / Math.max(caption.length * CHAR_WIDTH, 1))
  const half = (caption.length * CHAR_WIDTH * size) / 2
  const middle = { x: (line.x1 + line.x2) / 2 + up.x * offset, y: (line.y1 + line.y2) / 2 + up.y * offset }
  const corners = [-half, half].flatMap(a => [-size / 2, size / 2].map(b => ({
    x: middle.x + along.x * a + up.x * b, y: middle.y + along.y * a + up.y * b,
  })))
  // Slide along the line until every corner is on the page (as far as it can go both ways when it can't)
  let low = -Infinity
  let high = Infinity
  for (const [axis, limit] of [['x', width], ['y', height]]) {
    if (Math.abs(along[axis]) < 1e-9) continue
    const least = Math.min(...corners.map(point => point[axis]))
    const most = Math.max(...corners.map(point => point[axis]))
    const ends = [(0 - least) / along[axis], (limit - most) / along[axis]].sort((a, b) => a - b)
    low = Math.max(low, ends[0])
    high = Math.min(high, ends[1])
  }
  const shift = low <= high ? Math.min(Math.max(0, low), high) : (low + high) / 2
  return {
    x: middle.x + along.x * shift,
    y: middle.y + along.y * shift,
    angle: (angle * 180) / Math.PI,
    fontSize: size,
  }
}
