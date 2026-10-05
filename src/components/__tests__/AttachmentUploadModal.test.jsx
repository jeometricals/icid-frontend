import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AttachmentUploadModal from '../AttachmentUploadModal'
import * as attachments from '../../services/attachments'
import { TEST_USER_ID } from '../../test/users'

// Only the network call is mocked; validation, constants and error classes are the real ones
vi.mock('../../services/attachments', async (importOriginal) => ({
  ...(await importOriginal()),
  uploadAttachment: vi.fn(),
}))

const IDR_ID = 'idr-1'
const REPORT_ID = 'rep-1'

const UPLOADED = {
  attachment_id: 'att-1',
  file_name: 'crack.jpg',
  file_type: 'image/jpeg',
  file_size_bytes: 4,
  uploaded_by: TEST_USER_ID,
  uploaded_at: '2026-09-28T13:00:00Z',
  attachment_name: 'Crack at curb',
  attachment_description: 'North side',
}

const jpeg = () => new File(['abcd'], 'crack.jpg', { type: 'image/jpeg' })

function renderModal() {
  const handlers = { onUploaded: vi.fn(), onClose: vi.fn() }
  render(<AttachmentUploadModal idrId={IDR_ID} reportId={REPORT_ID} {...handlers} />)
  return handlers
}

const saveButton = () => screen.getByRole('button', { name: /^(save|retry|uploading\.\.\.)$/i })

// applyAccept off, so a file the input's accept list would hide can still be chosen, as a user can via "All files"
async function fillForm(user, { file = jpeg(), name = 'Crack at curb', description = 'North side' } = {}) {
  await user.upload(screen.getByLabelText('File'), file)
  if (name) await user.type(screen.getByLabelText('Name'), name)
  if (description) await user.type(screen.getByLabelText('Description'), description)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AttachmentUploadModal', () => {
  it('shows the file chooser limited to the allowed types, plus Name and Description', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Add attachment' })).toBeInTheDocument()
    expect(screen.getByLabelText('File')).toHaveAttribute('accept', attachments.ALLOWED_MIME_TYPES.join(','))
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
  })

  it('keeps Save disabled until a file, a name and a description are all given', async () => {
    const user = userEvent.setup()
    renderModal()
    expect(saveButton()).toBeDisabled()
    await user.upload(screen.getByLabelText('File'), jpeg())
    expect(saveButton()).toBeDisabled()
    await user.type(screen.getByLabelText('Name'), 'Crack at curb')
    expect(saveButton()).toBeDisabled()
    await user.type(screen.getByLabelText('Description'), 'North side')
    expect(saveButton()).toBeEnabled()
  })

  it('treats a whitespace-only name as missing', async () => {
    const user = userEvent.setup()
    renderModal()
    await fillForm(user, { name: '   ' })
    expect(saveButton()).toBeDisabled()
  })

  it('rejects a file over 10 MB as soon as it is chosen', async () => {
    const user = userEvent.setup()
    renderModal()
    const big = jpeg()
    Object.defineProperty(big, 'size', { value: attachments.MAX_FILE_SIZE_BYTES + 1 })
    await fillForm(user, { file: big })
    expect(screen.getByRole('alert')).toHaveTextContent('larger than the 10 MB limit')
    expect(saveButton()).toBeDisabled()
  })

  it('rejects an unsupported type as soon as it is chosen', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderModal()
    await fillForm(user, { file: new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }) })
    expect(screen.getByRole('alert')).toHaveTextContent('Unsupported file type')
    expect(saveButton()).toBeDisabled()
  })

  it('clears the file error when a valid file replaces a bad one', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderModal()
    await user.upload(screen.getByLabelText('File'), new File(['x'], 'notes.txt', { type: 'text/plain' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.upload(screen.getByLabelText('File'), jpeg())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('uploads with the chosen file, the uploader and the typed details, then reports the new attachment', async () => {
    const user = userEvent.setup()
    attachments.uploadAttachment.mockResolvedValue(UPLOADED)
    const { onUploaded } = renderModal()
    const file = jpeg()
    await fillForm(user, { file })
    await user.click(saveButton())

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(UPLOADED))
    expect(attachments.uploadAttachment).toHaveBeenCalledWith(IDR_ID, REPORT_ID, expect.objectContaining({
      file,
      name: 'Crack at curb',
      description: 'North side',
      onProgress: expect.any(Function),
    }))
  })

  it('shows the current step with a spinner and locks the form while uploading', async () => {
    const user = userEvent.setup()
    let finish
    attachments.uploadAttachment.mockImplementation((_, __, { onProgress }) => {
      onProgress({ step: 'uploading' })
      return new Promise(resolve => { finish = resolve })
    })
    const { onClose, onUploaded } = renderModal()
    await fillForm(user)
    await user.click(saveButton())

    expect(await screen.findByText('Uploading file...')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Uploading...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByLabelText('Name')).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()

    finish(UPLOADED)
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(UPLOADED))
  })

  it('on a storage failure shows the retry message, and Retry uploads again', async () => {
    const user = userEvent.setup()
    attachments.uploadAttachment
      .mockRejectedValueOnce(new attachments.StorageUnavailableError())
      .mockResolvedValueOnce(UPLOADED)
    const { onUploaded } = renderModal()
    await fillForm(user)
    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('Storage temporarily unavailable, try again.')
    expect(saveButton()).toHaveTextContent('Retry')
    await user.click(saveButton())
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(UPLOADED))
    expect(attachments.uploadAttachment).toHaveBeenCalledTimes(2)
  })

  it('on any other failure shows the backend message, keeps the form, and offers Save again', async () => {
    const user = userEvent.setup()
    attachments.uploadAttachment.mockRejectedValue(Object.assign(new Error('Only draft IDRs can be edited'), { status: 409 }))
    const { onUploaded } = renderModal()
    await fillForm(user)
    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('Only draft IDRs can be edited')
    expect(saveButton()).toHaveTextContent('Save')
    expect(screen.getByLabelText('Name')).toHaveValue('Crack at curb')
    expect(onUploaded).not.toHaveBeenCalled()
  })

  it('re-enables Save after a failed upload, and a second click uploads again', async () => {
    const user = userEvent.setup()
    attachments.uploadAttachment
      .mockRejectedValueOnce(Object.assign(new Error('Failed to save attachment'), { status: 500 }))
      .mockResolvedValueOnce(UPLOADED)
    const { onUploaded } = renderModal()
    await fillForm(user)
    await user.click(saveButton())

    await screen.findByRole('alert')
    expect(saveButton()).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    await user.click(saveButton())
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(UPLOADED))
  })

  it('sends one upload however fast Save is clicked', async () => {
    const user = userEvent.setup()
    attachments.uploadAttachment.mockReturnValue(new Promise(() => {}))
    renderModal()
    await fillForm(user)
    const save = saveButton()
    fireEvent.click(save)
    fireEvent.click(save)
    fireEvent.click(save)
    expect(attachments.uploadAttachment).toHaveBeenCalledTimes(1)
  })

  it('Cancel closes without uploading', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(attachments.uploadAttachment).not.toHaveBeenCalled()
  })
})
