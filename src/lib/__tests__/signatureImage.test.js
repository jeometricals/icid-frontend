import { describe, it, expect, vi, afterEach } from 'vitest'
import SignatureCanvas from 'react-signature-canvas'
import { SIGNATURE_MAX_BYTES, drawnSignatureBlob, inkBounds, trimmedCanvas } from '../signatureImage'

// RGBA pixels for a width x height canvas, transparent except the [x, y] points given
function pixels(width, height, inked = []) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (const [x, y] of inked) data[(y * width + x) * 4 + 3] = 255
  return data
}

// A stand-in for a canvas element holding those pixels
function fakeCanvas(width, height, inked = []) {
  return { width, height, getContext: () => ({ getImageData: () => ({ data: pixels(width, height, inked) }) }) }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the signature canvas package', () => {
  it('loads with a default export (the component the modal renders)', () => {
    expect(SignatureCanvas).toBeTruthy()
    expect(['function', 'object']).toContain(typeof SignatureCanvas)
  })
})

describe('inkBounds', () => {
  it('is null for a blank canvas', () => {
    expect(inkBounds(pixels(20, 10), 20, 10)).toBeNull()
  })

  it('boxes a single pixel', () => {
    expect(inkBounds(pixels(20, 10, [[7, 3]]), 20, 10)).toEqual({ left: 7, top: 3, right: 7, bottom: 3 })
  })

  it('boxes everything drawn, wherever the strokes are', () => {
    const inked = [[5, 8], [14, 2], [9, 6]]
    expect(inkBounds(pixels(20, 10, inked), 20, 10)).toEqual({ left: 5, top: 2, right: 14, bottom: 8 })
  })

  it('counts faint (partly transparent) ink too', () => {
    const data = pixels(4, 4)
    data[(2 * 4 + 1) * 4 + 3] = 1
    expect(inkBounds(data, 4, 4)).toEqual({ left: 1, top: 2, right: 1, bottom: 2 })
  })

  it('reaches the canvas edges', () => {
    expect(inkBounds(pixels(6, 4, [[0, 0], [5, 3]]), 6, 4)).toEqual({ left: 0, top: 0, right: 5, bottom: 3 })
  })
})

describe('trimmedCanvas', () => {
  function stubNewCanvas() {
    const drawImage = vi.fn()
    const cropped = { getContext: () => ({ drawImage }) }
    vi.spyOn(document, 'createElement').mockReturnValue(cropped)
    return { cropped, drawImage }
  }

  it('is null for a blank canvas', () => {
    expect(trimmedCanvas(fakeCanvas(300, 100))).toBeNull()
  })

  it('crops to the ink plus an 8 px margin', () => {
    const { cropped, drawImage } = stubNewCanvas()
    const source = fakeCanvas(300, 100, [[100, 40], [180, 60]])
    expect(trimmedCanvas(source)).toBe(cropped)
    // ink spans x 100-180, y 40-60: with the margin, x 92-188 and y 32-68
    expect([cropped.width, cropped.height]).toEqual([97, 37])
    expect(drawImage).toHaveBeenCalledWith(source, 92, 32, 97, 37, 0, 0, 97, 37)
  })

  it('never reaches past the canvas for its margin', () => {
    const { cropped, drawImage } = stubNewCanvas()
    const source = fakeCanvas(50, 30, [[2, 1], [48, 28]])
    trimmedCanvas(source)
    expect([cropped.width, cropped.height]).toEqual([50, 30])
    expect(drawImage).toHaveBeenCalledWith(source, 0, 0, 50, 30, 0, 0, 50, 30)
  })
})

describe('drawnSignatureBlob', () => {
  it('refuses a blank canvas', async () => {
    await expect(drawnSignatureBlob(fakeCanvas(300, 100))).rejects.toThrow('Draw your signature first.')
  })

  it('returns the cropped canvas as a PNG blob', async () => {
    const blob = new Blob(['png'], { type: 'image/png' })
    const toBlob = vi.fn((callback, type) => callback(type === 'image/png' ? blob : null))
    vi.spyOn(document, 'createElement').mockReturnValue({ getContext: () => ({ drawImage: vi.fn() }), toBlob })
    expect(await drawnSignatureBlob(fakeCanvas(300, 100, [[10, 10]]))).toBe(blob)
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png')
  })

  it('says so when the browser cannot make the image', async () => {
    vi.spyOn(document, 'createElement').mockReturnValue({
      getContext: () => ({ drawImage: vi.fn() }), toBlob: callback => callback(null),
    })
    await expect(drawnSignatureBlob(fakeCanvas(300, 100, [[10, 10]])))
      .rejects.toThrow('The drawing could not be turned into an image.')
  })
})

describe('SIGNATURE_MAX_BYTES', () => {
  it('matches the Storage bucket limit of 500 KB', () => {
    expect(SIGNATURE_MAX_BYTES).toBe(512000)
  })
})
