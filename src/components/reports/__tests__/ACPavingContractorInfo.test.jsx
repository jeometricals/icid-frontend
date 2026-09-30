import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ACPavingContractorInfo from '../ACPavingContractorInfo'

const LABELS = ['Paving Contractor Name', 'Subcontractor (if any)', 'Rice No. / Specific Gravity']

function renderInfo(props = {}) {
  const onChange = vi.fn()
  render(<ACPavingContractorInfo value={{}} onChange={onChange} {...props} />)
  return onChange
}

describe('ACPavingContractorInfo', () => {
  it('renders the three labelled fields, empty, with the Rice No. helper text', () => {
    renderInfo()
    expect(screen.getByRole('heading', { name: 'Paving Contractor Info' })).toBeInTheDocument()
    for (const label of LABELS) expect(screen.getByLabelText(label)).toHaveDisplayValue('')
    expect(screen.getByText('(Contractor to Supply)')).toBeInTheDocument()
  })

  it('uses text for the names and a 0.001-step number for the Rice No.', () => {
    renderInfo()
    expect(screen.getByLabelText('Paving Contractor Name')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Subcontractor (if any)')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Rice No. / Specific Gravity')).toHaveAttribute('type', 'number')
    expect(screen.getByLabelText('Rice No. / Specific Gravity')).toHaveAttribute('step', '0.001')
  })

  it('shows the saved values and calls onChange(field, value)', async () => {
    const onChange = renderInfo({ value: { pavingContractorName: 'Tri-State Paving', riceNo: '2.515' } })
    expect(screen.getByLabelText('Paving Contractor Name')).toHaveValue('Tri-State Paving')
    expect(screen.getByLabelText('Rice No. / Specific Gravity')).toHaveValue(2.515)
    await userEvent.setup().type(screen.getByLabelText('Subcontractor (if any)'), 'A')
    expect(onChange).toHaveBeenLastCalledWith('subcontractor', 'A')
  })

  it('disables every field when disabled', () => {
    renderInfo({ disabled: true })
    for (const label of LABELS) expect(screen.getByLabelText(label)).toBeDisabled()
  })
})
