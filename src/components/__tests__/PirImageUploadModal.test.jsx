import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PirImageUploadModal, { PDF_NOTE, STEP_LABELS, TOO_LARGE, fileSize } from '../PirImageUploadModal'
import * as pirImages from '../../services/pirImages'

vi.mock('../../services/pirImages', async (importOriginal) => ({ ...(await importOriginal()), uploadPirImage: vi.fn() }))

const PIR_ID = 'e0000000-0000-4000-8000-000000000001'
const PIR = { id: PIR_ID, source_image_url: 'pirs/x/image.png', source_image_scale: 20, signed_url: 'https://s/x' }

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
  render(<PirImageUploadModal pirId={PIR_ID} onUploaded={onUploaded} onClose={onClose} {...props} />)
  return { onUploaded, onClose }
}

const fileInput = () => screen.getByLabelText(/PIR image \(PDF, PNG or JPG\)/)
const scaleInput = () => screen.getByLabelText('Scale (px/ft)')
const uploadButton = () => screen.getByRole('button', { name: 'Upload' })

describe('PirImageUploadModal — picking', () => {
  it('opens "Upload PIR image" with 15 px/ft, taking PDF, PNG and JPG, Upload off', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Upload PIR image' })).toBeInTheDocument()
    expect(fileInput()).toHaveAttribute('accept', '.pdf,.png,.jpg,.jpeg')
    expect(scaleInput()).toHaveValue(15)
    expect(scaleInput()).toHaveAttribute('min', '1')
    expect(scaleInput()).toHaveAttribute('placeholder', 'e.g. 15')
    expect(uploadButton()).toBeDisabled()
  })

  it('says "Replace PIR image" and starts at the image\'s own scale when replacing', () => {
    renderModal({ replacing: true, initialScale: 22 })
    expect(screen.getByRole('dialog', { name: 'Replace PIR image' })).toBeInTheDocument()
    expect(scaleInput()).toHaveValue(22)
  })

  it('shows a picked image\'s name and size and previews it from the file', async () => {
    renderModal()
    await userEvent.upload(fileInput(), file('sheet.png', 'image/png', 340 * 1024))
    expect(screen.getByText('sheet.png · 340 KB')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Preview of the picked PIR image' })).toHaveAttribute('src', 'blob:preview')
    expect(uploadButton()).toBeEnabled()
  })

  it('says a PDF will be converted, with no preview', async () => {
    renderModal()
    await userEvent.upload(fileInput(), file('sheet.pdf', 'application/pdf', 1.5 * 1024 * 1024))
    expect(screen.getByText('sheet.pdf · 1.5 MB')).toBeInTheDocument()
    expect(screen.getByText(PDF_NOTE)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('refuses a file over 10 MB as soon as it is picked', async () => {
    renderModal()
    await userEvent.upload(fileInput(), file('huge.png', 'image/png', 10 * 1024 * 1024 + 1))
    expect(screen.getByRole('alert')).toHaveTextContent('The PIR image must be 10 MB or smaller.')
    expect(uploadButton()).toBeDisabled()
  })

  it.each([['', 'empty'], ['0', 'zero'], ['0.5', 'under 1'], ['-3', 'negative']])('keeps Upload off for a scale of "%s" (%s)', async (typed) => {
    renderModal()
    await userEvent.upload(fileInput(), file('sheet.png', 'image/png'))
    await userEvent.clear(scaleInput())
    if (typed) await userEvent.type(scaleInput(), typed)
    expect(uploadButton()).toBeDisabled()
  })

  it('prints sizes in KB and MB', () => {
    expect(fileSize(500)).toBe('1 KB')
    expect(fileSize(2048)).toBe('2 KB')
    expect(fileSize(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})

describe('PirImageUploadModal — uploading', () => {
  it('uploads the file at the scale, naming each step, then hands over the PIR', async () => {
    let finish
    pirImages.uploadPirImage.mockImplementation((pirId, picked, scale, { onProgress }) => {
      onProgress({ step: 'uploading' })
      return new Promise(resolve => { finish = resolve })
    })
    const { onUploaded } = renderModal()
    const png = file('sheet.png', 'image/png')
    await userEvent.upload(fileInput(), png)
    await userEvent.clear(scaleInput())
    await userEvent.type(scaleInput(), '20')
    await userEvent.click(uploadButton())

    expect(pirImages.uploadPirImage).toHaveBeenCalledWith(PIR_ID, png, 20, expect.objectContaining({ onProgress: expect.any(Function) }))
    expect(await screen.findByText(STEP_LABELS.uploading)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Uploading...' })).toBeDisabled()
    finish(PIR)
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(PIR))
  })

  it.each([
    ['a 413', Object.assign(new Error('File too large'), { status: 413 }), TOO_LARGE],
    ['a 400', Object.assign(new Error('Unsupported file type'), { status: 400 }), 'Unsupported file type'],
    ['a Storage failure', new Error('Could not reach file storage. Please try again.'), 'Could not reach file storage. Please try again.'],
  ])('shows %s inline and keeps the file', async (_, failure, shown) => {
    pirImages.uploadPirImage.mockRejectedValue(failure)
    const { onUploaded } = renderModal()
    await userEvent.upload(fileInput(), file('sheet.png', 'image/png'))
    await userEvent.click(uploadButton())
    expect(await screen.findByRole('alert')).toHaveTextContent(shown)
    expect(screen.getByText(/sheet\.png/)).toBeInTheDocument()
    expect(uploadButton()).toBeEnabled()
    expect(onUploaded).not.toHaveBeenCalled()
  })
})
