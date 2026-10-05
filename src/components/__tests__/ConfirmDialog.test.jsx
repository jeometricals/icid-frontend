import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmDialog from '../ConfirmDialog'

function renderDialog(props = {}) {
  const handlers = { onConfirm: vi.fn(), onCancel: vi.fn() }
  render(
    <ConfirmDialog
      title="Delete attachment"
      message="Delete this attachment? This cannot be undone."
      {...handlers}
      {...props}
    />
  )
  return handlers
}

describe('ConfirmDialog', () => {
  it('shows the title and the question with Yes and No buttons', () => {
    renderDialog()
    expect(screen.getByRole('dialog', { name: 'Delete attachment' })).toBeInTheDocument()
    expect(screen.getByText('Delete this attachment? This cannot be undone.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument()
  })

  it('calls onConfirm on Yes and onCancel on No', async () => {
    const { onConfirm, onCancel } = renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'No' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('treats Escape as No', async () => {
    const { onCancel } = renderDialog()
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('uses custom button labels', () => {
    renderDialog({ confirmLabel: 'Delete', cancelLabel: 'Keep' })
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument()
  })

  it('disables both buttons and shows Working... while busy, and cannot be dismissed', async () => {
    const { onCancel } = renderDialog({ busy: true })
    expect(screen.getByRole('button', { name: 'Working...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'No' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('shows the error from a failed action', () => {
    renderDialog({ error: 'Only draft IDRs can be edited' })
    expect(screen.getByRole('alert')).toHaveTextContent('Only draft IDRs can be edited')
  })
})

describe('ConfirmDialog note', () => {
  it('shows an optional second paragraph under the message', () => {
    render(<ConfirmDialog title="Certification" message="First statement." note="Second statement."
      onConfirm={() => {}} onCancel={() => {}} />)
    const message = screen.getByText('First statement.')
    const note = screen.getByText('Second statement.')
    expect(message.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('adds nothing when no note is given', () => {
    render(<ConfirmDialog title="Delete?" message="Only this." onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('dialog').querySelectorAll('p')).toHaveLength(1)
  })
})
