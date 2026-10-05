import { describe, it, expect, vi, afterEach } from 'vitest'
import SignatureCanvas from 'react-signature-canvas'
import { SIGNATURE_MAX_BYTES, drawnSignatureBlob, inkBounds, trimmedCanvas, typedSignatureBlob } from '../signatureImage'

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
      .rejects.toThrow('The signature could not be turned into an image.')
  })
})

describe('SIGNATURE_MAX_BYTES', () => {
  it('matches the Storage bucket limit of 500 KB', () => {
    expect(SIGNATURE_MAX_BYTES).toBe(512000)
  })
})

describe('typedSignatureBlob', () => {
  const PNG = new Blob(['png'], { type: 'image/png' })

  // Stands in for the browser: a font set that has (or lacks) the font, and canvases that record what is drawn
  function stubBrowser({ faces = [{}], inked = [[150, 140]] } = {}) {
    const fonts = { load: vi.fn().mockResolvedValue(faces) }
    Object.defineProperty(document, 'fonts', { value: fonts, configurable: true })
    const drawn = []
    const canvases = []
    vi.spyOn(document, 'createElement').mockImplementation(() => {
      const canvas = { width: 0, height: 0, toBlob: callback => callback(PNG) }
      canvas.getContext = () => ({
        set font(value) { canvas.font = value },
        set fillStyle(value) { canvas.fillStyle = value },
        set textBaseline(value) { canvas.textBaseline = value },
        measureText: text => ({ width: text.length * 40 }),
        fillText: (text, x, y) => drawn.push({ text, x, y, font: canvas.font, fillStyle: canvas.fillStyle }),
        getImageData: () => {
          const data = new Uint8ClampedArray(canvas.width * canvas.height * 4)
          for (const [x, y] of inked) data[(y * canvas.width + x) * 4 + 3] = 255
          return { data }
        },
        drawImage: vi.fn(),
      })
      canvases.push(canvas)
      return canvas
    })
    return { fonts, drawn, canvases }
  }

  it('waits for the chosen font, draws the name in it, and returns the cropped PNG', async () => {
    const { fonts, drawn, canvases } = stubBrowser()
    expect(await typedSignatureBlob('Genghis Khan', 'Great Vibes')).toBe(PNG)
    expect(fonts.load).toHaveBeenCalledWith('96px "Great Vibes"', 'Genghis Khan')
    expect(drawn).toEqual([{ text: 'Genghis Khan', x: 96, y: 144, font: '96px "Great Vibes"', fillStyle: '#111827' }])
    // sized to the text, with room either side: 12 characters x 40 px + 2 x 96
    expect([canvases[0].width, canvases[0].height]).toEqual([672, 288])
    expect(canvases).toHaveLength(2) // the drawing canvas and the cropped copy
  })

  it('trims the text and grows the canvas with a longer name', async () => {
    const { drawn, canvases } = stubBrowser()
    await typedSignatureBlob('  Zoë Núñez-O’Brien Junior  ', 'Caveat')
    expect(drawn[0].text).toBe('Zoë Núñez-O’Brien Junior')
    expect(canvases[0].width).toBe(drawn[0].text.length * 40 + 192)
    expect(drawn[0].text.length).toBeGreaterThan(12)
  })

  it('refuses blank text without touching the fonts', async () => {
    const { fonts } = stubBrowser()
    await expect(typedSignatureBlob('   ', 'Caveat')).rejects.toThrow('Type your name first.')
    expect(fonts.load).not.toHaveBeenCalled()
  })

  it('refuses to sign in a fallback font when the chosen one is not there', async () => {
    const { drawn } = stubBrowser({ faces: [] })
    await expect(typedSignatureBlob('Genghis Khan', 'Satisfy'))
      .rejects.toThrow('The signature font could not be loaded. Check your connection and try again.')
    expect(drawn).toEqual([])
  })

  it('treats a font file that fails to download the same way', async () => {
    const { fonts } = stubBrowser()
    fonts.load.mockRejectedValue(new Error('NetworkError'))
    await expect(typedSignatureBlob('Genghis Khan', 'Satisfy')).rejects.toThrow('The signature font could not be loaded.')
  })

  it('says so when the text left no ink (e.g. only characters the font lacks)', async () => {
    stubBrowser({ inked: [] })
    await expect(typedSignatureBlob('Genghis Khan', 'Caveat')).rejects.toThrow('Type your name first.')
  })
})
