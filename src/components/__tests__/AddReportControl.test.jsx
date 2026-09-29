import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddReportControl from '../AddReportControl'

function renderControl(props = {}) {
  const onAdd = vi.fn()
  render(<AddReportControl onAdd={onAdd} adding={false} disabled={false} generalExists={false} {...props} />)
  return onAdd
}

describe('AddReportControl', () => {
  it('lists all 22 report types, with only General and SWCB enabled and the rest "coming soon"', () => {
    renderControl()
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(22)
    const available = ['General', 'Sidewalk, Curb, Concrete Base']
    for (const option of options) {
      if (available.includes(option.textContent)) {
        expect(option).toBeEnabled()
      } else {
        expect(option.textContent).toMatch(/ \(coming soon\)$/)
        expect(option).toBeDisabled()
      }
    }
    expect(options.filter(o => o.disabled)).toHaveLength(20)
    expect(screen.getByRole('option', { name: 'Sidewalk, Curb, Concrete Base' })).toHaveValue('SWCB')
    expect(screen.getByRole('option', { name: 'Sewer (coming soon)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Field Order (coming soon)' })).toBeInTheDocument()
  })

  it('starts on General', () => {
    renderControl()
    expect(screen.getByLabelText('Add report')).toHaveValue('GEN')
  })

  it('adds the selected type', async () => {
    const onAdd = renderControl()
    await userEvent.setup().click(screen.getByRole('button', { name: /add/i }))
    expect(onAdd).toHaveBeenCalledWith('GEN')
  })

  it('adds an SWCB report', async () => {
    const onAdd = renderControl()
    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Add report'), 'SWCB')
    await user.click(screen.getByRole('button', { name: /add/i }))
    expect(onAdd).toHaveBeenCalledWith('SWCB')
  })

  it('marks General unavailable and disables Add once the IDR has a General', () => {
    renderControl({ generalExists: true })
    expect(screen.getByRole('option', { name: 'General (already added)' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /add/i })).toBeDisabled()
  })

  it('shows "Adding..." and disables Add while adding', () => {
    renderControl({ adding: true })
    expect(screen.getByRole('button', { name: /adding/i })).toBeDisabled()
  })

  it('disables Add while another action is running', () => {
    renderControl({ disabled: true })
    expect(screen.getByRole('button', { name: /add/i })).toBeDisabled()
  })
})
