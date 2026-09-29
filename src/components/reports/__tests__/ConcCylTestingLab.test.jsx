import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConcCylTestingLab from '../ConcCylTestingLab'

const EMPTY = { labName: '', labAddress: '', labPhonePrimary: '', labPhoneAlt: '' }
const LABELS = ['Laboratory Name', 'Address', 'Phone', 'Phone (alt)']

function renderLab(props = {}) {
  const onChange = vi.fn()
  render(<ConcCylTestingLab value={EMPTY} onChange={onChange} {...props} />)
  return onChange
}

describe('ConcCylTestingLab', () => {
  it('renders the four fields stacked, with the address as a 2-row textarea', () => {
    renderLab()
    expect(screen.getByRole('heading', { name: 'Testing Laboratory' })).toBeInTheDocument()
    for (const label of LABELS) expect(screen.getByLabelText(label)).toHaveValue('')
    const address = screen.getByLabelText('Address')
    expect(address.tagName).toBe('TEXTAREA')
    expect(address).toHaveAttribute('rows', '2')
  })

  it('shows the saved values', () => {
    renderLab({ value: { labName: 'Acme Labs', labAddress: '1 Main St', labPhonePrimary: '555-0100', labPhoneAlt: '' } })
    expect(screen.getByLabelText('Laboratory Name')).toHaveValue('Acme Labs')
    expect(screen.getByLabelText('Address')).toHaveValue('1 Main St')
    expect(screen.getByLabelText('Phone')).toHaveValue('555-0100')
  })

  it('calls onChange(field, value)', async () => {
    const onChange = renderLab()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Phone (alt)'), '5')
    expect(onChange).toHaveBeenLastCalledWith('labPhoneAlt', '5')
    await user.type(screen.getByLabelText('Address'), 'Q')
    expect(onChange).toHaveBeenLastCalledWith('labAddress', 'Q')
  })

  it('disables every field when disabled', () => {
    renderLab({ disabled: true })
    for (const label of LABELS) expect(screen.getByLabelText(label)).toBeDisabled()
  })
})
