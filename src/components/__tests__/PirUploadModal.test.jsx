import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PirUploadModal, { REPLACE_WARNING, STEP_LABELS, TOO_LARGE, UPLOAD_PROMPT, fileSize } from '../PirUploadModal'
import * as pirPages from '../../services/pirPages'

vi.mock('../../services/pirPages', async (importOriginal) => ({ ...(await importOriginal()), uploadPir: vi.fn() }))

const PIR_ID = 'e0000000-0000-4000-8000-000000000001'
const PIR = { id: PIR_ID, pages: [{ pir_page_id: 'p1', page_number: 1 }, { pir_page_id: 'p2', page_number: 2 }] }

const file = (name, type, size = 2048) => new File([new Uint8Array(size)], name, { type })

beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  delete URL.createObjectURL
  delete URL.revokeObjectURL
})

function renderModal(props = {}) {
  const onUploaded = vi.fn()
  const onClose = vi.fn()
  render(<PirUploadModal pirId={PIR_ID} onUploaded={onUploaded} onClose={onClose} {...props} />)
  return { onUploaded, onClose }
}

const fileInput = () => screen.getByLabelText(/PIR file \(PDF, PNG or JPG\)/)
const scaleInput = () => screen.getByLabelText('Scale (px/ft, every page)')
const uploadButton = () => screen.getByRole('button', { name: 'Upload' })

describe('PirUploadModal — picking', () => {
  it('opens "Upload PIR" with its prompt and 15 px/ft, taking PDF, PNG and JPG, Upload off', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Upload PIR' })).toBeInTheDocument()
    expect(screen.getByText(UPLOAD_PROMPT)).toBeInTheDocument()
    expect(screen.queryByText(REPLACE_WARNING)).not.toBeInTheDocument()
    expect(fileInput()).toHaveAttribute('accept', '.pdf,.png,.jpg,.jpeg')
    expect(scaleInput()).toHaveValue(15)
    expect(uploadButton()).toBeDisabled()
  })

  it('says "Replace PIR" and warns that the pages and their flags go', () => {
    renderModal({ replacing: true })
    expect(screen.getByRole('dialog', { name: 'Replace PIR' })).toBeInTheDocument()
    expect(screen.getByText(REPLACE_WARNING)).toBeInTheDocument()
  })

  it('shows a picked image\'s name and size and previews it from the file', async () => {
    renderModal()
    await userEvent.upload(fileInput(), file('sheet.png', 'image/png', 340 * 1024))
    expect(screen.getByText('sheet.png · 340 KB')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Preview of the picked PIR image' })).toHaveAttribute('src', 'blob:preview')
    expect(uploadButton()).toBeEnabled()
  })

  it('takes a PDF with no preview', async () => {
    renderModal()
    await userEvent.upload(fileInput(), file('sheet.pdf', 'application/pdf', 1.5 * 1024 * 1024))
    expect(screen.getByText('sheet.pdf · 1.5 MB')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(uploadButton()).toBeEnabled()
  })

  it('refuses a file over 10 MB as soon as it is picked', async () => {
    renderModal()
    await userEvent.upload(fileInput(), file('huge.png', 'image/png', 10 * 1024 * 1024 + 1))
    expect(screen.getByRole('alert')).toHaveTextContent('The PIR file must be 10 MB or smaller.')
    expect(uploadButton()).toBeDisabled()
  })

  it.each([['0', 'zero'], ['0.5', 'under 1'], ['-3', 'negative']])('keeps Upload off for a scale of "%s" (%s)', async (typed) => {
    renderModal()
    await userEvent.upload(fileInput(), file('sheet.png', 'image/png'))
    await userEvent.clear(scaleInput())
    await userEvent.type(scaleInput(), typed)
    expect(uploadButton()).toBeDisabled()
  })

  it('prints sizes in KB and MB', () => {
    expect(fileSize(500)).toBe('1 KB')
    expect(fileSize(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})

describe('PirUploadModal — uploading', () => {
  it('uploads the file at the scale, saying "Rendering..." while the pages render, then hands over the PIR', async () => {
    let finish
    pirPages.uploadPir.mockImplementation((pirId, picked, { onProgress }) => {
      onProgress({ step: 'rendering' })
      return new Promise(resolve => { finish = resolve })
    })
    const { onUploaded } = renderModal()
    const pdf = file('sheet.pdf', 'application/pdf')
    await userEvent.upload(fileInput(), pdf)
    await userEvent.clear(scaleInput())
    await userEvent.type(scaleInput(), '20')
    await userEvent.click(uploadButton())

    expect(pirPages.uploadPir).toHaveBeenCalledWith(PIR_ID, pdf, expect.objectContaining({ scale: 20, onProgress: expect.any(Function) }))
    expect(await screen.findByText(STEP_LABELS.rendering)).toBeInTheDocument()
    expect(STEP_LABELS.rendering).toBe('Rendering...')
    expect(screen.getByRole('button', { name: 'Uploading...' })).toBeDisabled()
    finish(PIR)
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(PIR))
  })

  it('sends no scale when the box is left blank', async () => {
    pirPages.uploadPir.mockResolvedValue(PIR)
    renderModal()
    await userEvent.upload(fileInput(), file('sheet.png', 'image/png'))
    await userEvent.clear(scaleInput())
    await userEvent.click(uploadButton())
    expect(pirPages.uploadPir).toHaveBeenCalledWith(PIR_ID, expect.any(File), expect.objectContaining({ scale: null }))
  })

  it.each([
    ['a 413', Object.assign(new Error('File too large'), { status: 413 }), TOO_LARGE],
    ['a 400', Object.assign(new Error('The PDF has 16 pages; a PIR can have at most 15'), { status: 400 }), 'The PDF has 16 pages; a PIR can have at most 15'],
    ['a Storage failure', new Error('Could not reach file storage. Please try again.'), 'Could not reach file storage. Please try again.'],
  ])('shows %s inline and keeps the file', async (_, failure, shown) => {
    pirPages.uploadPir.mockRejectedValue(failure)
    const { onUploaded } = renderModal()
    await userEvent.upload(fileInput(), file('sheet.png', 'image/png'))
    await userEvent.click(uploadButton())
    expect(await screen.findByRole('alert')).toHaveTextContent(shown)
    expect(screen.getByText(/sheet\.png/)).toBeInTheDocument()
    expect(uploadButton()).toBeEnabled()
    expect(onUploaded).not.toHaveBeenCalled()
  })
})
