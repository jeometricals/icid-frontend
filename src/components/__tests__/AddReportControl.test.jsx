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
  it('lists all 21 report types, with only General enabled and the rest "coming soon"', () => {
    renderControl()
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(21)
    expect(options[0]).toHaveTextContent(/^General$/)
    expect(options[0]).toBeEnabled()
    for (const option of options.slice(1)) {
      expect(option.textContent).toMatch(/ \(coming soon\)$/)
      expect(option).toBeDisabled()
    }
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
