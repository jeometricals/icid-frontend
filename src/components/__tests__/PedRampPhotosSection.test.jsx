import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PedRampPhotosSection, { NO_PHOTOS_WARNING } from '../PedRampPhotosSection'
import * as api from '../../services/api'

vi.mock('../../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  listPhotos: vi.fn(), uploadPhoto: vi.fn(), updatePhoto: vi.fn(), deletePhoto: vi.fn(),
}))

const INSPECTION = { type: 'inspection', id: 'e0000000-0000-4000-8000-000000000001' }
const TIF = { type: 'tif', id: 'f0000000-0000-4000-8000-000000000001' }
const RAMP_A = 'a0000000-0000-4000-8000-000000000001'
const RAMP_B = 'a0000000-0000-4000-8000-000000000002'

const photo = (number, propertyId = RAMP_A, extra = {}) => ({
  id: `p-${number}-${extra.kind ?? 'photo'}`, kind: 'photo', photo_number: number, property_id: propertyId,
  caption: `Caption ${number}`, image_url: `https://s/${number}.jpg`, ...extra,
})
const jpeg = (size = 1024) => new File([new Uint8Array(size)], 'ramp.jpg', { type: 'image/jpeg' })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PedRampPhotosSection', () => {
  it("shows this ramp's photos and counts the whole form's", async () => {
    api.listPhotos.mockResolvedValue([photo(2), photo(1, RAMP_B), photo(5)])
    render(<PedRampPhotosSection parent={INSPECTION} propertyId={RAMP_A} canEdit />)
    expect(await screen.findByText('Photo 2')).toBeInTheDocument()
    expect(screen.getByText('Photo 5')).toBeInTheDocument()
    expect(screen.queryByText('Photo 1')).not.toBeInTheDocument()
    expect(screen.getByText('3 of 20 photos on this form')).toBeInTheDocument()
    expect(screen.getByAltText('Photo 2')).toHaveAttribute('src', 'https://s/2.jpg')
    expect(screen.getByLabelText('Photo #')).toHaveValue('3') // the next free number on the form
    expect(api.listPhotos).toHaveBeenCalledWith(INSPECTION)
  })

  it('uploads with the number and caption, then lists the new photo', async () => {
    const user = userEvent.setup()
    const onPhotosChange = vi.fn()
    api.listPhotos.mockResolvedValue([])
    api.uploadPhoto.mockResolvedValue(photo(1, RAMP_A, { caption: 'North' }))
    render(<PedRampPhotosSection parent={INSPECTION} propertyId={RAMP_A} canEdit onPhotosChange={onPhotosChange} />)
    const file = jpeg()
    await user.upload(await screen.findByLabelText('Photo'), file)
    await user.type(screen.getByLabelText('Caption'), ' North ')
    await user.click(screen.getByRole('button', { name: 'Upload' }))
    expect(await screen.findByText('Photo 1')).toBeInTheDocument()
    expect(api.uploadPhoto).toHaveBeenCalledWith(INSPECTION, file, { photoNumber: 1, caption: 'North', kind: 'photo', propertyId: RAMP_A })
    expect(screen.getByText('1 of 20 photos on this form')).toBeInTheDocument()
    await waitFor(() => expect(onPhotosChange).toHaveBeenLastCalledWith([expect.objectContaining({ photo_number: 1 })]))
  })

  it('refuses a number used anywhere on the form, and a photo over 10 MB, before uploading', async () => {
    const user = userEvent.setup()
    api.listPhotos.mockResolvedValue([photo(1, RAMP_B)])
    render(<PedRampPhotosSection parent={INSPECTION} propertyId={RAMP_A} canEdit />)
    await user.upload(await screen.findByLabelText('Photo'), jpeg())
    await user.clear(screen.getByLabelText('Photo #'))
    await user.type(screen.getByLabelText('Photo #'), '1')
    await user.click(screen.getByRole('button', { name: 'Upload' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Photo number 1 is already used on this form')

    await user.upload(screen.getByLabelText('Photo'), jpeg(10 * 1024 * 1024 + 1))
    await user.clear(screen.getByLabelText('Photo #'))
    await user.type(screen.getByLabelText('Photo #'), '2')
    await user.click(screen.getByRole('button', { name: 'Upload' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Photo too large: at most 10 MB')
    expect(api.uploadPhoto).not.toHaveBeenCalled()
  })

  it("shows the backend's refusal as it words it", async () => {
    const user = userEvent.setup()
    api.listPhotos.mockResolvedValue([])
    api.uploadPhoto.mockRejectedValue(new Error('Inspection is submitted — only the RE can edit'))
    render(<PedRampPhotosSection parent={INSPECTION} propertyId={RAMP_A} canEdit />)
    await user.upload(await screen.findByLabelText('Photo'), jpeg())
    await user.click(screen.getByRole('button', { name: 'Upload' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Inspection is submitted — only the RE can edit')
  })

  it('turns Upload off at 20 photos on the form', async () => {
    api.listPhotos.mockResolvedValue(Array.from({ length: 20 }, (_, i) => photo(i + 1, i < 10 ? RAMP_A : RAMP_B)))
    render(<PedRampPhotosSection parent={INSPECTION} propertyId={RAMP_A} canEdit />)
    expect(await screen.findByText('20 of 20 photos on this form')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled()
    expect(screen.getByText('A form takes at most 20 photos')).toBeInTheDocument()
  })

  it('edits the number and caption inline, sending only what changed', async () => {
    const user = userEvent.setup()
    api.listPhotos.mockResolvedValue([photo(2), photo(3, RAMP_B)])
    api.updatePhoto.mockResolvedValue(photo(4, RAMP_A, { id: 'p-2-photo', caption: 'Caption 2' }))
    render(<PedRampPhotosSection parent={INSPECTION} propertyId={RAMP_A} canEdit />)
    await user.click(await screen.findByRole('button', { name: 'Edit photo 2' }))
    const card = screen.getByRole('button', { name: 'Save' }).closest('li')
    const number = within(card).getByLabelText('Photo #')
    await user.clear(number)
    await user.type(number, '3')
    await user.click(within(card).getByRole('button', { name: 'Save' }))
    expect(within(card).getByRole('alert')).toHaveTextContent('Photo number 3 is already used on this form')
    await user.clear(number)
    await user.type(number, '4')
    await user.click(within(card).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Photo 4')).toBeInTheDocument()
    expect(api.updatePhoto).toHaveBeenCalledWith('p-2-photo', { photo_number: 4 })
  })

  it('deletes a photo once confirmed', async () => {
    const user = userEvent.setup()
    api.listPhotos.mockResolvedValue([photo(2)])
    api.deletePhoto.mockResolvedValue()
    render(<PedRampPhotosSection parent={INSPECTION} propertyId={RAMP_A} canEdit />)
    await user.click(await screen.findByRole('button', { name: 'Delete photo 2' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByText('Photo 2')).not.toBeInTheDocument())
    expect(api.deletePhoto).toHaveBeenCalledWith('p-2-photo')
    expect(screen.getByText('No photos yet.')).toBeInTheDocument()
  })

  it('is read-only without canEdit', async () => {
    api.listPhotos.mockResolvedValue([photo(2)])
    render(<PedRampPhotosSection parent={INSPECTION} propertyId={RAMP_A} canEdit={false} />)
    expect(await screen.findByText('Photo 2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Edit|Delete|Upload/ })).not.toBeInTheDocument()
  })

  it("gives a TIF a single layout slot beside its photos", async () => {
    const user = userEvent.setup()
    api.listPhotos.mockResolvedValue([photo(1, RAMP_A)])
    api.uploadPhoto.mockResolvedValue(photo(1, RAMP_A, { id: 'layout', kind: 'layout', caption: null }))
    render(<PedRampPhotosSection parent={TIF} canEdit kinds={['photo', 'layout']} />)
    expect(await screen.findByText('Site design / layout')).toBeInTheDocument()
    expect(screen.getByText('No layout yet.')).toBeInTheDocument()
    const file = jpeg()
    await user.upload(screen.getByLabelText('Layout image'), file)
    await user.click(screen.getByRole('button', { name: 'Upload layout' }))
    expect(await screen.findByAltText('Site design / layout')).toBeInTheDocument()
    expect(api.uploadPhoto).toHaveBeenCalledWith(TIF, file, expect.objectContaining({ kind: 'layout', photoNumber: 1 }))
    expect(screen.queryByRole('button', { name: 'Upload layout' })).not.toBeInTheDocument()
    expect(screen.getByText('Photo 1')).toBeInTheDocument()
  })

  it('says when the photos cannot be read, and retries', async () => {
    const user = userEvent.setup()
    api.listPhotos.mockRejectedValueOnce(new Error('Project access required')).mockResolvedValueOnce([])
    render(<PedRampPhotosSection parent={INSPECTION} propertyId={RAMP_A} canEdit />)
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the photos: Project access required")
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No photos yet.')).toBeInTheDocument()
  })

  it('exports the submit warning', () => {
    expect(NO_PHOTOS_WARNING).toBe('No photos yet: DOT asks for at least four of each ramp. You can still submit for the pilot.')
  })
})
