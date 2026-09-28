import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AttachmentEditModal from '../AttachmentEditModal'
import * as attachments from '../../services/attachments'

vi.mock('../../services/attachments', async (importOriginal) => ({
  ...(await importOriginal()),
  updateAttachmentMetadata: vi.fn(),
}))

const IDR_ID = 'idr-1'
const REPORT_ID = 'rep-1'

const ATTACHMENT = {
  attachment_id: 'att-1',
  file_name: 'crack.jpg',
  file_type: 'image/jpeg',
  file_size_bytes: 4,
  uploaded_by: 'user-1',
  uploaded_at: '2026-09-28T13:00:00Z',
  attachment_name: 'Crack at curb',
  attachment_description: 'North side',
}

function renderModal() {
  const handlers = { onSaved: vi.fn(), onClose: vi.fn() }
  render(<AttachmentEditModal idrId={IDR_ID} reportId={REPORT_ID} attachment={ATTACHMENT} {...handlers} />)
  return handlers
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AttachmentEditModal', () => {
  it('opens with the current name and description filled in and shows the file name', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Edit attachment' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Crack at curb')
    expect(screen.getByLabelText('Description')).toHaveValue('North side')
    expect(screen.getByText('File: crack.jpg')).toBeInTheDocument()
  })

  it('disables Save when the name or the description is blank', async () => {
    const user = userEvent.setup()
    renderModal()
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeEnabled()
    await user.clear(screen.getByLabelText('Name'))
    expect(save).toBeDisabled()
    await user.type(screen.getByLabelText('Name'), 'Renamed')
    await user.clear(screen.getByLabelText('Description'))
    await user.type(screen.getByLabelText('Description'), '   ')
    expect(save).toBeDisabled()
  })

  it('saves the edited fields and reports the updated attachment', async () => {
    const user = userEvent.setup()
    const updated = { ...ATTACHMENT, attachment_name: 'Renamed' }
    attachments.updateAttachmentMetadata.mockResolvedValue(updated)
    const { onSaved } = renderModal()
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Renamed')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updated))
    expect(attachments.updateAttachmentMetadata).toHaveBeenCalledWith(IDR_ID, REPORT_ID, 'att-1', {
      name: 'Renamed',
      description: 'North side',
    })
  })

  it('shows Saving... and locks the form while the request runs', async () => {
    const user = userEvent.setup()
    attachments.updateAttachmentMetadata.mockReturnValue(new Promise(() => {}))
    const { onClose } = renderModal()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByLabelText('Name')).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('on failure shows the backend message, stays open and can save again', async () => {
    const user = userEvent.setup()
    attachments.updateAttachmentMetadata.mockRejectedValue(
      Object.assign(new Error('Only draft IDRs can be edited'), { status: 409 })
    )
    const { onSaved } = renderModal()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Only draft IDRs can be edited')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('Cancel closes without saving', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(attachments.updateAttachmentMetadata).not.toHaveBeenCalled()
  })
})
