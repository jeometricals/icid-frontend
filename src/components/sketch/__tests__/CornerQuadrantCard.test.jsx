import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import CornerQuadrantCard, { PREVIEW_DELAY_MS } from '../CornerQuadrantCard'

const OE = { H: '5.66', C: '18.00', R1: '12.58', R2: '12.00', A: '4.83', B: '3.83' }
const LABELS = ['H (height)', 'C (chord)', 'R1 (leg 1)', 'R2 (leg 2)', 'A (length)', 'B (width)']

// The card as FlagPanel holds it: what is typed kept by the parent
function Holder({ start = OE, onSave = vi.fn(), ...props }) {
  const [typed, setTyped] = useState(start)
  return <CornerQuadrantCard typed={typed} onChange={setTyped} onSave={onSave} {...props} />
}

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const save = () => screen.getByRole('button', { name: 'Save measurement' })
const preview = () => screen.getByTestId('corner-quadrant-preview')

afterEach(() => {
  vi.useRealTimers()
})

describe('CornerQuadrantCard (Slice Y5)', () => {
  it('shows the OE diagram and the six inputs, two to a row', () => {
    render(<Holder />)
    const diagram = screen.getByTestId('corner-quadrant-diagram')
    for (const label of ['A1', 'R₁', 'R₂', 'H', 'C', 'A', 'B']) {
      expect([...diagram.querySelectorAll('text')].some(text => text.textContent === label)).toBe(true)
    }
    expect(LABELS.map(label => screen.getByLabelText(label).value)).toEqual(Object.values(OE))
    expect(screen.getByText(/Enter 0 if none/)).toBeInTheDocument()
  })

  it("works out the OE sheet's figures: rows cut to the cent, 129.87 in all", () => {
    render(<Holder />)
    expect(preview()).toHaveTextContent('H / C5.66 / 18.000.31')
    expect(preview()).toHaveTextContent('Coef (0.31)0.7154')
    expect(preview()).toHaveTextContent('Arc segment0.7154 × 18.00 × 5.6672.88')
    expect(preview()).toHaveTextContent('Triangle0.5 × 12.58 × 12.0075.48')
    expect(preview()).toHaveTextContent('Correction4.83 × 3.83−18.49')
    expect(screen.getByTestId('corner-quadrant-area')).toHaveTextContent('129.87 sq ft')
  })

  it(`works the preview out again ${PREVIEW_DELAY_MS} ms after the last change`, () => {
    vi.useFakeTimers()
    render(<Holder />)
    type('A (length)', '0')
    expect(screen.getByTestId('corner-quadrant-area')).toHaveTextContent('129.87 sq ft')
    act(() => { vi.advanceTimersByTime(PREVIEW_DELAY_MS - 10) })
    expect(screen.getByTestId('corner-quadrant-area')).toHaveTextContent('129.87 sq ft')
    act(() => { vi.advanceTimersByTime(20) })
    expect(screen.getByTestId('corner-quadrant-area')).toHaveTextContent('148.36 sq ft')
  })

  it('saves the six as numbers', () => {
    const onSave = vi.fn()
    render(<Holder onSave={onSave} />)
    fireEvent.click(save())
    expect(onSave).toHaveBeenCalledWith({ H: 5.66, C: 18, R1: 12.58, R2: 12, A: 4.83, B: 3.83 })
  })

  it.each([
    ['H (height)', '', 'Above 0, at most two decimal places.'],
    ['R1 (leg 1)', '12.585', 'Above 0, at most two decimal places.'],
    ['C (chord)', '-3', 'Above 0, at most two decimal places.'],
    ['B (width)', '-1', '0 or more, at most two decimal places.'],
  ])('keeps Save off while %s is %j, saying why under it', (label, value, message) => {
    render(<Holder />)
    type(label, value)
    expect(screen.getByRole('alert')).toHaveTextContent(message)
    expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true')
    expect(save()).toBeDisabled()
  })

  it.each([
    [{ H: '10' }, 'H/C must come to between 0.01 and 0.50'],
    [{ A: '20', B: '10' }, 'Correction rectangle exceeds arc + triangle'],
  ])("keeps Save off while the whole doesn't work out (%j)", (changes, message) => {
    render(<Holder start={{ ...OE, ...changes }} />)
    expect(screen.getByRole('alert')).toHaveTextContent(message)
    expect(save()).toBeDisabled()
    expect(preview()).toHaveTextContent('Enter all six to work out the area.')
  })

  it('takes 0 and 0 for no correction', () => {
    render(<Holder start={{ ...OE, A: '0', B: '0' }} />)
    expect(save()).toBeEnabled()
    expect(screen.getByTestId('corner-quadrant-area')).toHaveTextContent('148.36 sq ft')
  })

  it('shows a reader the figures without Save', () => {
    render(<Holder disabled />)
    expect(screen.getByLabelText('H (height)')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save measurement' })).not.toBeInTheDocument()
    expect(screen.getByTestId('corner-quadrant-area')).toHaveTextContent('129.87 sq ft')
  })
})
