import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SWCBInspectionMatrix from '../SWCBInspectionMatrix'

const ROW_KEYS = [
  'subgradeCompacted', 'compactionTestTaken', 'sidewalkFoundationPlaced', 'roadwayStoneBasePlaced',
  'curingCompoundApplied', 'otherCuringMethods', 'rebarInstalled',
]
const EMPTY_MATRIX = Object.fromEntries(ROW_KEYS.map(key => [key, { base: null, sidewalk: null, curb: null }]))

function renderMatrix(props = {}) {
  const onChange = vi.fn()
  render(<SWCBInspectionMatrix matrix={EMPTY_MATRIX} onChange={onChange} {...props} />)
  return onChange
}

// Holds the matrix in state so clicks re-render, as the page does
function StatefulMatrix() {
  const [matrix, setMatrix] = useState(EMPTY_MATRIX)
  return (
    <SWCBInspectionMatrix
      matrix={matrix}
      onChange={(rowKey, column, value) => setMatrix(m => ({ ...m, [rowKey]: { ...m[rowKey], [column]: value } }))}
    />
  )
}

const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
const radio = (name) => screen.getByRole('radio', { name })

describe('SWCBInspectionMatrix', () => {
  it('renders the Inspection Matrix card with Item, Base, Sidewalk and Curb columns', () => {
    renderMatrix()
    expect(screen.getByRole('heading', { name: 'Inspection Matrix' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Item', 'Base', 'Sidewalk', 'Curb'])
  })

  it('renders the seven inspection items in order', () => {
    renderMatrix()
    expect(bodyRows().map(r => r.cells[0].textContent)).toEqual([
      'Subgrade Compacted',
      'Compaction Test Taken',
      'Sidewalk 6" Foundation Material Placed and Compacted',
      'Roadway Stone Base Placed and Compacted',
      'Curing Compound Applied',
      'Other Curing Methods',
      'Rebar Installed per Approved Shop Drawings and Bending Schedule?',
    ])
  })

  it('has Y, N and N/A radios in each of the three cells of every row, all unchecked when empty', () => {
    renderMatrix()
    for (const row of bodyRows()) {
      const cells = Array.from(row.cells).slice(1)
      expect(cells).toHaveLength(3)
      for (const cell of cells) {
        const radios = within(cell).getAllByRole('radio')
        expect(radios.map(r => r.parentElement.textContent)).toEqual(['Y', 'N', 'N/A'])
        for (const r of radios) expect(r).not.toBeChecked()
      }
    }
    expect(screen.getAllByRole('radio')).toHaveLength(7 * 3 * 3)
  })

  it('shows saved answers in the right cell', () => {
    renderMatrix({ matrix: { ...EMPTY_MATRIX, compactionTestTaken: { base: 'Y', sidewalk: 'NA', curb: null } } })
    expect(radio('Compaction Test Taken, Base: Y')).toBeChecked()
    expect(radio('Compaction Test Taken, Sidewalk: N/A')).toBeChecked()
    for (const option of ['Y', 'N', 'N/A']) expect(radio(`Compaction Test Taken, Curb: ${option}`)).not.toBeChecked()
    expect(radio('Subgrade Compacted, Base: Y')).not.toBeChecked()
  })

  it('calls onChange(rowKey, column, value) with Y, N or NA', async () => {
    const onChange = renderMatrix()
    const user = userEvent.setup()
    await user.click(radio('Subgrade Compacted, Curb: N'))
    expect(onChange).toHaveBeenLastCalledWith('subgradeCompacted', 'curb', 'N')
    await user.click(radio('Other Curing Methods, Sidewalk: N/A'))
    expect(onChange).toHaveBeenLastCalledWith('otherCuringMethods', 'sidewalk', 'NA')
    await user.click(radio('Rebar Installed per Approved Shop Drawings and Bending Schedule?, Base: Y'))
    expect(onChange).toHaveBeenLastCalledWith('rebarInstalled', 'base', 'Y')
  })

  it('keeps one answer per cell, independent of the other cells', async () => {
    render(<StatefulMatrix />)
    const user = userEvent.setup()
    await user.click(radio('Subgrade Compacted, Base: Y'))
    await user.click(radio('Subgrade Compacted, Sidewalk: N'))
    await user.click(radio('Subgrade Compacted, Base: N/A'))

    expect(radio('Subgrade Compacted, Base: N/A')).toBeChecked()
    expect(radio('Subgrade Compacted, Base: Y')).not.toBeChecked()
    expect(radio('Subgrade Compacted, Sidewalk: N')).toBeChecked()
    expect(radio('Compaction Test Taken, Base: N/A')).not.toBeChecked()
  })

  it('disables every radio when disabled', () => {
    renderMatrix({ disabled: true })
    for (const r of screen.getAllByRole('radio')) expect(r).toBeDisabled()
  })
})
