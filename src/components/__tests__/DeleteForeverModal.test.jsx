import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DeleteForeverModal from '../DeleteForeverModal'

function renderModal(props = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <DeleteForeverModal
      title="Delete IDR forever?"
      warning="This will permanently remove IDR 004 and all its data. This can't be undone."
      phrase="004"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />
  )
  return { onConfirm, onCancel }
}

const phraseBox = () => screen.getByLabelText('Type 004 to confirm.')
const confirmButton = () => screen.getByRole('button', { name: 'Delete forever' })

describe('DeleteForeverModal', () => {
  it('warns what will go, in red, and starts with an empty box and its button off', () => {
    renderModal({ note: 'IDR: Sep 16, 2026 on HWS0023 (Genghis Khan)' })
    expect(screen.getByRole('dialog', { name: 'Delete IDR forever?' })).toBeInTheDocument()
    const warning = screen.getByRole('alert')
    expect(warning).toHaveTextContent("This will permanently remove IDR 004 and all its data. This can't be undone.")
    expect(warning).toHaveClass('bg-red-50')
    expect(screen.getByText('IDR: Sep 16, 2026 on HWS0023 (Genghis Khan)')).toBeInTheDocument()
    expect(phraseBox()).toHaveValue('')
    expect(confirmButton()).toBeDisabled()
    expect(confirmButton()).toHaveClass('btn-danger')
  })

  it('turns the button on only while the box holds the phrase exactly', async () => {
    renderModal()
    await userEvent.type(phraseBox(), '00')
    expect(confirmButton()).toBeDisabled()
    await userEvent.type(phraseBox(), '4')
    expect(confirmButton()).toBeEnabled()
    await userEvent.type(phraseBox(), ' ')
    expect(confirmButton()).toBeDisabled()
  })

  it('compares capitals too', async () => {
    renderModal({ phrase: '12A' })
    await userEvent.type(screen.getByLabelText('Type 12A to confirm.'), '12a')
    expect(confirmButton()).toBeDisabled()
  })

  it('confirms on the button, and on Enter, once the phrase is in', async () => {
    const { onConfirm } = renderModal()
    await userEvent.type(phraseBox(), '004')
    await userEvent.click(confirmButton())
    await userEvent.type(phraseBox(), '{Enter}')
    expect(onConfirm).toHaveBeenCalledTimes(2)
  })

  it('does not confirm on Enter with the wrong phrase', async () => {
    const { onConfirm } = renderModal()
    await userEvent.type(phraseBox(), '005{Enter}')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('cancels without confirming', async () => {
    const { onConfirm, onCancel } = renderModal()
    await userEvent.type(phraseBox(), '004')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('locks itself while the delete runs', () => {
    renderModal({ busy: true })
    expect(phraseBox()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Working...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('shows why the delete failed', () => {
    renderModal({ error: "Couldn't delete the IDR: IDR must be soft-deleted first" })
    expect(screen.getByText("Couldn't delete the IDR: IDR must be soft-deleted first")).toBeInTheDocument()
  })
})
