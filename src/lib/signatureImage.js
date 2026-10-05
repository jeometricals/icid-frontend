/**
 * Turns what was drawn on a signature canvas into the PNG that gets uploaded: cropped to the ink, so the signature
 * fills the signature line on the printed form instead of sitting small inside a mostly empty canvas.
 */

// The backend's Storage bucket takes PNG only, 500 KB at most
export const SIGNATURE_MAX_BYTES = 512000
const TRIM_PADDING_PX = 8

/**
 * Finds the box around everything drawn. Takes RGBA pixel data (4 bytes a pixel, row by row) and its width and
 * height. Returns {left, top, right, bottom} (inclusive pixel coordinates), or null when nothing is drawn
 * (every pixel fully transparent).
 */
export function inkBounds(data, width, height) {
  let left = width, top = height, right = -1, bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }
  return right < 0 ? null : { left, top, right, bottom }
}

/**
 * Copies the drawn part of a canvas onto a new one, with a small margin. Takes the canvas.
 * Returns the cropped canvas, or null when nothing is drawn.
 */
export function trimmedCanvas(canvas) {
  const { width, height } = canvas
  const bounds = inkBounds(canvas.getContext('2d').getImageData(0, 0, width, height).data, width, height)
  if (!bounds) return null
  const left = Math.max(0, bounds.left - TRIM_PADDING_PX)
  const top = Math.max(0, bounds.top - TRIM_PADDING_PX)
  const right = Math.min(width - 1, bounds.right + TRIM_PADDING_PX)
  const bottom = Math.min(height - 1, bounds.bottom + TRIM_PADDING_PX)
  const cropped = document.createElement('canvas')
  cropped.width = right - left + 1
  cropped.height = bottom - top + 1
  cropped.getContext('2d').drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height)
  return cropped
}

// Crops a canvas to its ink and turns it into a PNG Blob; throws emptyMessage when nothing is on it
async function croppedPngBlob(canvas, emptyMessage) {
  const cropped = trimmedCanvas(canvas)
  if (!cropped) throw new Error(emptyMessage)
  const blob = await new Promise(resolve => cropped.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('The signature could not be turned into an image. Please try again.')
  return blob
}

/**
 * Turns a drawn signature into a PNG Blob, cropped to the ink. Takes the signature canvas.
 * Throws when nothing is drawn or the browser can't make the image.
 */
export async function drawnSignatureBlob(canvas) {
  return croppedPngBlob(canvas, 'Draw your signature first.')
}

// A typed signature is drawn large (so it stays sharp when the form scales it down) in the app's dark ink
const TYPED_FONT_PX = 96
const TYPED_INK = '#111827'

/**
 * Turns a typed name into a signature PNG Blob: the text drawn in a handwriting font, cropped to the ink.
 * Takes the text and the font's family name (one of the fonts the app bundles, e.g. 'Dancing Script').
 * Waits for the font to load first, and throws if it can't be loaded (rather than sign in a fallback font), if
 * the text is blank, or if the browser can't make the image.
 */
export async function typedSignatureBlob(text, fontFamily) {
  const name = text.trim()
  if (!name) throw new Error('Type your name first.')
  const font = `${TYPED_FONT_PX}px "${fontFamily}"`
  // load() gives the font faces it loaded for this text: none means the font isn't there (or its file couldn't be
  // fetched), and the browser would quietly draw the name in some other font
  const faces = await document.fonts.load(font, name).catch(() => [])
  if (faces.length === 0) {
    throw new Error('The signature font could not be loaded. Check your connection and try again.')
  }
  const canvas = document.createElement('canvas')
  const measuring = canvas.getContext('2d')
  measuring.font = font
  // Room for flourishes that swing outside the measured width and above or below the line
  canvas.width = Math.ceil(measuring.measureText(name).width) + TYPED_FONT_PX * 2
  canvas.height = TYPED_FONT_PX * 3
  const context = canvas.getContext('2d') // sizing a canvas resets its context, so the font is set again
  context.font = font
  context.fillStyle = TYPED_INK
  context.textBaseline = 'middle'
  context.fillText(name, TYPED_FONT_PX, canvas.height / 2)
  return croppedPngBlob(canvas, 'Type your name first.')
}
