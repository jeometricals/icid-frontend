import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SketchCanvas from '../SketchCanvas'

const PAGE = { pir_page_id: 'p1', page_number: 1, image_url: 'https://s/p1.png', width_px: 1200, height_px: 800, scale_px_per_ft: 10 }

describe('SketchCanvas — alignment', () => {
  it.each([0, 90, 180, 270])('lays the overlay over the image in native pixels at %i°, inside the turned box', (rotation) => {
    render(<SketchCanvas page={{ ...PAGE, rotation_deg: rotation }} flags={[]} showCorners />)
    const overlay = screen.getByTestId('sketch-overlay')
    const box = screen.getByTestId('page-box')
    // The overlay and the image share the box that is turned, so they turn together
    expect(box).toContainElement(overlay)
    expect(box).toContainElement(screen.getByRole('img', { name: 'PIR page 1' }))
    expect(box.style.transform).toContain(`rotate(${rotation}deg)`)
    expect(overlay).toHaveAttribute('viewBox', '0 0 1200 800')
    // The corner marks sit at (0, 0) and (width, height) of the page
    const corners = [...screen.getByTestId('corner-marks').querySelectorAll('[data-corner]')].map(mark => mark.dataset.corner)
    expect(corners).toEqual(['0,0', '1200,800'])
  })

  it('draws no corner marks unless asked, and no flag without a scale', () => {
    render(<SketchCanvas page={{ ...PAGE, rotation_deg: 0, scale_px_per_ft: null }} flags={[{
      id: 'f1', display_order: 1, shape: 'rectangle', dimensions: { L: 5, W: 5 }, sketch_x: 10, sketch_y: 10, surveyed_thickness: '4in',
    }]} />)
    expect(screen.queryByTestId('corner-marks')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Flag #1' })).not.toBeInTheDocument()
  })
})
