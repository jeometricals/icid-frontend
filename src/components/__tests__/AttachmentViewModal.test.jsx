import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AttachmentViewModal from '../AttachmentViewModal'
import * as attachments from '../../services/attachments'

vi.mock('../../services/attachments', async (importOriginal) => ({
  ...(await importOriginal()),
  getDownloadUrl: vi.fn(),
}))

const IDR_ID = 'idr-1'
const REPORT_ID = 'rep-1'
const URL_1 = 'https://storage.example.com/sign/crack.jpg?token=1'
const URL_2 = 'https://storage.example.com/sign/crack.jpg?token=2'

const IMAGE = {
  attachment_id: 'att-1',
  file_name: 'crack.jpg',
  file_type: 'image/jpeg',
  file_size_bytes: 4,
  uploaded_by: 'user-1',
  uploaded_at: '2026-09-28T13:00:00Z',
  attachment_name: 'Crack at curb',
  attachment_description: 'North side, station 12+50',
}

const signed = url => ({ download_url: url, expires_at: '2026-09-28T13:05:00Z' })

function renderModal() {
  const onClose = vi.fn()
  render(<AttachmentViewModal idrId={IDR_ID} reportId={REPORT_ID} attachment={IMAGE} onClose={onClose} />)
  return { onClose }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AttachmentViewModal', () => {
  it('shows a spinner, then the full-size image from a freshly signed URL', async () => {
    attachments.getDownloadUrl.mockResolvedValue(signed(URL_1))
    renderModal()
    expect(screen.getByRole('status')).toBeInTheDocument()

    const img = await screen.findByRole('img', { name: 'Crack at curb' })
    expect(img).toHaveAttribute('src', URL_1)
    expect(attachments.getDownloadUrl).toHaveBeenCalledWith(IDR_ID, REPORT_ID, 'att-1')
  })

  it('is titled with the attachment name and shows its description', async () => {
    attachments.getDownloadUrl.mockResolvedValue(signed(URL_1))
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Crack at curb' })).toBeInTheDocument()
    expect(screen.getByText('North side, station 12+50')).toBeInTheDocument()
    await screen.findByRole('img')
  })

  it('fetches a new URL once when the image fails to load (expired link)', async () => {
    attachments.getDownloadUrl.mockResolvedValueOnce(signed(URL_1)).mockResolvedValueOnce(signed(URL_2))
    renderModal()
    fireEvent.error(await screen.findByRole('img'))

    await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', URL_2))
    expect(attachments.getDownloadUrl).toHaveBeenCalledTimes(2)
  })

  it('gives up after a second image failure, and Retry starts over', async () => {
    attachments.getDownloadUrl.mockResolvedValue(signed(URL_1))
    renderModal()
    fireEvent.error(await screen.findByRole('img'))
    await waitFor(() => expect(attachments.getDownloadUrl).toHaveBeenCalledTimes(2))
    fireEvent.error(await screen.findByRole('img'))

    expect(await screen.findByRole('alert')).toHaveTextContent("This image couldn't be displayed.")
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('img')).toBeInTheDocument()
    expect(attachments.getDownloadUrl).toHaveBeenCalledTimes(3)
  })

  it('shows the storage message with Retry when Storage cannot sign the URL', async () => {
    attachments.getDownloadUrl
      .mockRejectedValueOnce(new attachments.StorageUnavailableError())
      .mockResolvedValueOnce(signed(URL_1))
    renderModal()

    expect(await screen.findByRole('alert')).toHaveTextContent('Storage temporarily unavailable, try again.')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('img')).toHaveAttribute('src', URL_1)
  })

  it('shows the backend message for other failures', async () => {
    attachments.getDownloadUrl.mockRejectedValue(Object.assign(new Error('Attachment not found'), { status: 404 }))
    renderModal()
    expect(await screen.findByRole('alert')).toHaveTextContent('Attachment not found')
  })

  it('closes on the X button', async () => {
    attachments.getDownloadUrl.mockResolvedValue(signed(URL_1))
    const { onClose } = renderModal()
    await screen.findByRole('img')
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
