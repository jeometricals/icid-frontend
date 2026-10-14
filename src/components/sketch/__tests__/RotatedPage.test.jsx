import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RotatedPage from '../RotatedPage'
import { isSideways, rotatedSize } from '../../../lib/pageGeometry'

const PAGE = { pir_page_id: 'p1', page_number: 2, image_url: 'https://s/p2.png', width_px: 1200, height_px: 800, rotation_deg: 0 }

describe('RotatedPage', () => {
  it('shows the page upright in a box of its own proportions, never wider than the page', () => {
    render(<RotatedPage page={PAGE} />)
    const outer = screen.getByTestId('rotated-page')
    expect(outer).toHaveAttribute('data-width', '1200')
    expect(outer).toHaveAttribute('data-height', '800')
    expect(outer.style.maxWidth).toBe('1200px')
    expect(screen.getByRole('img', { name: 'PIR page 2' })).toHaveAttribute('src', PAGE.image_url)
    expect(screen.getByTestId('page-box').style.transform).toBe('translate(-50%, -50%) rotate(0deg)')
  })

  it.each([90, 270])('swaps the box for %i degrees and turns the native-size page inside it', (rotation) => {
    render(<RotatedPage page={{ ...PAGE, rotation_deg: rotation }} />)
    const outer = screen.getByTestId('rotated-page')
    expect(outer).toHaveAttribute('data-width', '800')
    expect(outer).toHaveAttribute('data-height', '1200')
    const box = screen.getByTestId('page-box')
    expect(box.style.transform).toContain(`rotate(${rotation}deg)`)
    // the inner box keeps the page's own proportions: 1200 / 800 of the outer width, 800 / 1200 of its height
    expect(box.style.width).toBe('150%')
    expect(parseFloat(box.style.height)).toBeCloseTo(66.667, 2)
  })

  it('draws what it is given (the sketch overlay) inside the turned box', () => {
    render(<RotatedPage page={{ ...PAGE, rotation_deg: 180 }}><svg data-testid="overlay" /></RotatedPage>)
    expect(screen.getByTestId('page-box')).toContainElement(screen.getByTestId('overlay'))
  })

  it('knows which rotations lie on their side', () => {
    expect([0, 90, 180, 270].map(isSideways)).toEqual([false, true, false, true])
    expect(rotatedSize({ width_px: 10, height_px: 4, rotation_deg: 270 })).toEqual({ width: 4, height: 10 })
  })
})
