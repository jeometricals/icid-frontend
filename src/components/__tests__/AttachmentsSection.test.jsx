import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { format } from 'date-fns'
import AttachmentsSection from '../AttachmentsSection'
import * as attachments from '../../services/attachments'
import { TEST_USER_ID } from '../../test/users'

// Only the network calls are mocked; validation and error classes are the real ones
vi.mock('../../services/attachments', async (importOriginal) => ({
  ...(await importOriginal()),
  listAttachments: vi.fn(),
  getDownloadUrl: vi.fn(),
  uploadAttachment: vi.fn(),
  updateAttachmentMetadata: vi.fn(),
  deleteAttachment: vi.fn(),
}))

const IDR_ID = 'idr-1'
const REPORT_ID = 'rep-1'
const THUMB_URL = 'https://storage.example.com/sign/crack.jpg?token=t'
const PDF_URL = 'https://storage.example.com/sign/plan.pdf?token=p'

const IMAGE = {
  attachment_id: 'att-img',
  file_name: 'crack.jpg',
  file_type: 'image/jpeg',
  file_size_bytes: 2_516_582,
  uploaded_by: TEST_USER_ID,
  uploaded_at: '2026-09-28T13:00:00Z',
  attachment_name: 'Crack at curb',
  attachment_description: 'North side, station 12+50',
}

const PDF = {
  ...IMAGE,
  attachment_id: 'att-pdf',
  file_name: 'plan.pdf',
  file_type: 'application/pdf',
  file_size_bytes: 20_480,
  attachment_name: 'Site plan',
  attachment_description: 'Sheet 3',
}

const signed = url => ({ download_url: url, expires_at: '2026-09-28T13:05:00Z' })

function renderSection(props = {}) {
  return render(<AttachmentsSection idrId={IDR_ID} reportId={REPORT_ID} isSubmitted={false} {...props} />)
}

// The <li> for one attachment, found by its name
const card = name => screen.getByText(name).closest('li')

beforeEach(() => {
  vi.clearAllMocks()
  attachments.listAttachments.mockResolvedValue([])
  attachments.getDownloadUrl.mockImplementation(async (_, __, id) => signed(id === PDF.attachment_id ? PDF_URL : THUMB_URL))
})

describe('loading', () => {
  it('lists the report attachments once on mount, with a spinner meanwhile', async () => {
    renderSection()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(await screen.findByText('No attachments yet.')).toBeInTheDocument()
    expect(attachments.listAttachments).toHaveBeenCalledTimes(1)
    expect(attachments.listAttachments).toHaveBeenCalledWith(IDR_ID, REPORT_ID)
  })

  it('shows the load error, and Retry lists again', async () => {
    attachments.listAttachments
      .mockRejectedValueOnce(Object.assign(new Error('Report not found in this IDR'), { status: 404 }))
      .mockResolvedValueOnce([IMAGE])
    renderSection()

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load attachments: Report not found in this IDR")
    expect(screen.queryByRole('button', { name: /add attachment/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Crack at curb')).toBeInTheDocument()
    expect(attachments.listAttachments).toHaveBeenCalledTimes(2)
  })

  it('adds className to the card', async () => {
    const { container } = renderSection({ className: 'mb-6' })
    await screen.findByText('No attachments yet.')
    expect(container.firstChild).toHaveClass('mb-6')
  })
})

describe('empty state', () => {
  it('invites adding a file on a draft IDR', async () => {
    renderSection()
    expect(await screen.findByText('No attachments yet.')).toBeInTheDocument()
    expect(screen.getByText(/add photos, sketches or pdfs/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add attachment/i })).toBeInTheDocument()
  })

  it('on a submitted IDR shows the locked note and no way to add', async () => {
    renderSection({ isSubmitted: true })
    expect(await screen.findByText('No attachments yet.')).toBeInTheDocument()
    expect(screen.getByText('IDR submitted; attachments cannot be modified')).toBeInTheDocument()
    expect(screen.queryByText(/add photos, sketches or pdfs/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add attachment/i })).not.toBeInTheDocument()
  })
})

describe('attachment cards', () => {
  it('shows name, description, file name, size and upload time for each attachment', async () => {
    attachments.listAttachments.mockResolvedValue([IMAGE, PDF])
    renderSection()
    const image = within(await screen.findByText('Crack at curb').then(el => el.closest('li')))
    expect(image.getByText('North side, station 12+50')).toBeInTheDocument()
    const uploadedAt = format(new Date(IMAGE.uploaded_at), 'MMM d, yyyy HH:mm')
    expect(image.getByText(`crack.jpg · 2.4 MB · ${uploadedAt}`)).toBeInTheDocument()
    expect(within(card('Site plan')).getByText(/plan\.pdf · 20 KB/)).toBeInTheDocument()
  })

  it('shows a real thumbnail for an image and an icon for a PDF (no URL fetched for it)', async () => {
    attachments.listAttachments.mockResolvedValue([IMAGE, PDF])
    renderSection()
    expect(await screen.findByRole('img', { name: 'Crack at curb' })).toHaveAttribute('src', THUMB_URL)
    expect(screen.queryByRole('img', { name: 'Site plan' })).not.toBeInTheDocument()
    expect(attachments.getDownloadUrl).toHaveBeenCalledTimes(1)
    expect(attachments.getDownloadUrl).toHaveBeenCalledWith(IDR_ID, REPORT_ID, IMAGE.attachment_id)
  })

  it('treats HEIC like a PDF: icon, no thumbnail fetch', async () => {
    attachments.listAttachments.mockResolvedValue([{ ...IMAGE, file_type: 'image/heic' }])
    renderSection()
    await screen.findByText('Crack at curb')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(attachments.getDownloadUrl).not.toHaveBeenCalled()
  })

  it('falls back to an icon marked "Preview unavailable" when the thumbnail URL cannot be fetched', async () => {
    attachments.listAttachments.mockResolvedValue([IMAGE])
    attachments.getDownloadUrl.mockRejectedValue(new attachments.StorageUnavailableError())
    renderSection()
    expect(await screen.findByTitle('Preview unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('refreshes an expired thumbnail URL once, then falls back to the icon', async () => {
    attachments.listAttachments.mockResolvedValue([IMAGE])
    renderSection()
    fireEvent.error(await screen.findByRole('img', { name: 'Crack at curb' }))
    await waitFor(() => expect(attachments.getDownloadUrl).toHaveBeenCalledTimes(2))

    fireEvent.error(screen.getByRole('img', { name: 'Crack at curb' }))
    expect(await screen.findByTitle('Preview unavailable')).toBeInTheDocument()
    expect(attachments.getDownloadUrl).toHaveBeenCalledTimes(2)
  })

  it('offers View, Edit and Delete on a draft IDR', async () => {
    attachments.listAttachments.mockResolvedValue([IMAGE])
    renderSection()
    await screen.findByText('Crack at curb')
    const row = within(card('Crack at curb'))
    expect(row.getByRole('button', { name: 'View' })).toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('on a submitted IDR keeps only View, hides Add, and shows the locked note', async () => {
    attachments.listAttachments.mockResolvedValue([IMAGE])
    renderSection({ isSubmitted: true })
    await screen.findByText('Crack at curb')
    const row = within(card('Crack at curb'))
    expect(row.getByRole('button', { name: 'View' })).toBeEnabled()
    expect(row.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(row.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add attachment/i })).not.toBeInTheDocument()
    expect(screen.getByText('IDR submitted; attachments cannot be modified')).toBeInTheDocument()
  })
})

describe('upload', () => {
  it('opens the upload modal and adds the uploaded file to the list without re-listing', async () => {
    const user = userEvent.setup()
    attachments.uploadAttachment.mockResolvedValue(IMAGE)
    renderSection()
    await user.click(await screen.findByRole('button', { name: /add attachment/i }))
    expect(screen.getByRole('dialog', { name: 'Add attachment' })).toBeInTheDocument()

    await user.upload(screen.getByLabelText('File'), new File(['abcd'], 'crack.jpg', { type: 'image/jpeg' }))
    await user.type(screen.getByLabelText('Name'), 'Crack at curb')
    await user.type(screen.getByLabelText('Description'), 'North side, station 12+50')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Crack at curb')).toBeInTheDocument()
    expect(screen.queryByText('No attachments yet.')).not.toBeInTheDocument()
    expect(await screen.findByRole('img', { name: 'Crack at curb' })).toHaveAttribute('src', THUMB_URL)
    expect(attachments.uploadAttachment).toHaveBeenCalledWith(IDR_ID, REPORT_ID,
      expect.objectContaining({ name: 'Crack at curb' }))
    expect(attachments.listAttachments).toHaveBeenCalledTimes(1)
  })

  it('keeps the list and the open modal unchanged when an upload fails', async () => {
    const user = userEvent.setup()
    attachments.listAttachments.mockResolvedValue([PDF])
    attachments.uploadAttachment.mockRejectedValue(new attachments.StorageUnavailableError())
    renderSection()
    await user.click(await screen.findByRole('button', { name: /add attachment/i }))
    await user.upload(screen.getByLabelText('File'), new File(['abcd'], 'crack.jpg', { type: 'image/jpeg' }))
    await user.type(screen.getByLabelText('Name'), 'Crack at curb')
    await user.type(screen.getByLabelText('Description'), 'North side')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const dialog = screen.getByRole('dialog', { name: 'Add attachment' })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Storage temporarily unavailable')
    expect(screen.getByText('Site plan')).toBeInTheDocument()
    expect(attachments.listAttachments).toHaveBeenCalledTimes(1)
  })

  it('Cancel closes the upload modal', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.click(await screen.findByRole('button', { name: /add attachment/i }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('edit', () => {
  it('opens the edit modal for that attachment and updates its card on save', async () => {
    const user = userEvent.setup()
    attachments.listAttachments.mockResolvedValue([IMAGE])
    attachments.updateAttachmentMetadata.mockImplementation(async (_, __, ___, { name }) => ({ ...IMAGE, attachment_name: name }))
    renderSection()
    await screen.findByText('Crack at curb')
    await user.click(within(card('Crack at curb')).getByRole('button', { name: 'Edit' }))

    expect(screen.getByRole('dialog', { name: 'Edit attachment' })).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Crack, repaired')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Crack, repaired')).toBeInTheDocument()
    expect(screen.queryByText('Crack at curb')).not.toBeInTheDocument()
    expect(screen.getByText('North side, station 12+50')).toBeInTheDocument()
  })
})

describe('edit, switching attachments', () => {
  it("reopening Edit on another attachment shows that attachment's values, not the previous one's", async () => {
    const user = userEvent.setup()
    attachments.listAttachments.mockResolvedValue([IMAGE, PDF])
    attachments.updateAttachmentMetadata.mockImplementation(async (_, __, id, { name, description }) => ({
      ...(id === PDF.attachment_id ? PDF : IMAGE), attachment_name: name, attachment_description: description,
    }))
    renderSection()
    await screen.findByText('Crack at curb')

    // Open A and type without saving, then cancel
    await user.click(within(card('Crack at curb')).getByRole('button', { name: 'Edit' }))
    await user.type(screen.getByLabelText('Name'), ' (unsaved)')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    // Open B: its own values, nothing carried over from A
    await user.click(within(card('Site plan')).getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Site plan')
    expect(screen.getByLabelText('Description')).toHaveValue('Sheet 3')

    // Saving B updates B only
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(attachments.updateAttachmentMetadata).toHaveBeenCalledWith(IDR_ID, REPORT_ID, PDF.attachment_id, {
      name: 'Site plan', description: 'Sheet 3',
    })
    expect(screen.getByText('Crack at curb')).toBeInTheDocument()

    // Reopening A after that shows A's saved values, not the abandoned typing
    await user.click(within(card('Crack at curb')).getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Crack at curb')
  })
})

describe('delete', () => {
  async function openDeleteDialog(user) {
    attachments.listAttachments.mockResolvedValue([IMAGE, PDF])
    renderSection()
    await screen.findByText('Crack at curb')
    await user.click(within(card('Crack at curb')).getByRole('button', { name: 'Delete' }))
  }

  it('asks first, and Yes deletes the attachment and removes its card', async () => {
    const user = userEvent.setup()
    attachments.deleteAttachment.mockResolvedValue(undefined)
    await openDeleteDialog(user)

    expect(screen.getByRole('dialog', { name: 'Delete attachment' })).toHaveTextContent(
      'Delete this attachment? This cannot be undone.'
    )
    expect(attachments.deleteAttachment).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Yes' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(attachments.deleteAttachment).toHaveBeenCalledWith(IDR_ID, REPORT_ID, IMAGE.attachment_id)
    expect(screen.queryByText('Crack at curb')).not.toBeInTheDocument()
    expect(screen.getByText('Site plan')).toBeInTheDocument()
    expect(attachments.listAttachments).toHaveBeenCalledTimes(1)
  })

  it('sends one delete however fast Yes is clicked', async () => {
    const user = userEvent.setup()
    attachments.deleteAttachment.mockReturnValue(new Promise(() => {}))
    await openDeleteDialog(user)
    const yes = screen.getByRole('button', { name: 'Yes' })
    fireEvent.click(yes)
    fireEvent.click(yes)
    fireEvent.click(yes)

    expect(attachments.deleteAttachment).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Working...' })).toBeDisabled()
  })

  it('No closes the dialog and keeps the attachment', async () => {
    const user = userEvent.setup()
    await openDeleteDialog(user)
    await user.click(screen.getByRole('button', { name: 'No' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(attachments.deleteAttachment).not.toHaveBeenCalled()
    expect(screen.getByText('Crack at curb')).toBeInTheDocument()
  })

  it('shows a failed delete inside the dialog and keeps the card', async () => {
    const user = userEvent.setup()
    attachments.deleteAttachment.mockRejectedValue(Object.assign(new Error('Only draft IDRs can be edited'), { status: 409 }))
    await openDeleteDialog(user)
    await user.click(screen.getByRole('button', { name: 'Yes' }))

    const dialog = screen.getByRole('dialog', { name: 'Delete attachment' })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Only draft IDRs can be edited')
    expect(within(dialog).getByRole('button', { name: 'Yes' })).toBeEnabled()
    expect(screen.getByText('Crack at curb')).toBeInTheDocument()
  })
})

describe('view', () => {
  it('opens an image in the in-page viewer', async () => {
    const user = userEvent.setup()
    attachments.listAttachments.mockResolvedValue([IMAGE])
    renderSection()
    await screen.findByText('Crack at curb')
    await user.click(within(card('Crack at curb')).getByRole('button', { name: 'View' }))

    const viewer = screen.getByRole('dialog', { name: 'Crack at curb' })
    expect(await within(viewer).findByRole('img', { name: 'Crack at curb' })).toHaveAttribute('src', THUMB_URL)
  })

  it('opens a PDF in a new tab pointed at a freshly signed URL', async () => {
    const user = userEvent.setup()
    const tab = { location: { href: '' }, opener: window, close: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(tab)
    attachments.listAttachments.mockResolvedValue([PDF])
    renderSection()
    await screen.findByText('Site plan')
    await user.click(within(card('Site plan')).getByRole('button', { name: 'View' }))

    expect(open).toHaveBeenCalledWith('', '_blank')
    await waitFor(() => expect(tab.location.href).toBe(PDF_URL))
    expect(tab.opener).toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the tab and shows a Retry banner when Storage cannot sign the PDF URL', async () => {
    const user = userEvent.setup()
    const tab = { location: { href: '' }, opener: null, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(tab)
    attachments.listAttachments.mockResolvedValue([PDF])
    attachments.getDownloadUrl.mockRejectedValueOnce(new attachments.StorageUnavailableError())
    renderSection()
    await screen.findByText('Site plan')
    await user.click(within(card('Site plan')).getByRole('button', { name: 'View' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Storage temporarily unavailable, try again.')
    expect(tab.close).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(tab.location.href).toBe(PDF_URL))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says so when the browser blocks the new tab, and the banner can be dismissed', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'open').mockReturnValue(null)
    attachments.listAttachments.mockResolvedValue([PDF])
    renderSection()
    await screen.findByText('Site plan')
    await user.click(within(card('Site plan')).getByRole('button', { name: 'View' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/blocked the new tab for Site plan/)
    expect(attachments.getDownloadUrl).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
