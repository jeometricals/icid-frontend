import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PirImageSection, { NO_IMAGE_TEXT, scaleCaption } from '../PirImageSection'
import * as api from '../../services/api'

vi.mock('../../services/api', () => ({ getPirImageSignedUrl: vi.fn(), removePirImage: vi.fn() }))
vi.mock('../PirImageUploadModal', () => ({
  default: ({ replacing, onUploaded, onClose }) => (
    <div role="dialog" aria-label={replacing ? 'Replace PIR image' : 'Upload PIR image'}>
      <button type="button" onClick={() => onUploaded({})}>Finish upload</button>
      <button type="button" onClick={onClose}>Close</button>
    </div>
  ),
}))

const PIR = { id: 'e0000000-0000-4000-8000-000000000001', source_image_url: null, source_image_scale: null }
const WITH_IMAGE = { ...PIR, source_image_url: 'pirs/x/image.png', source_image_scale: 15 }
const LINK = { signed_url: 'https://storage.example/sign/pir.png?token=t', expires_at: '2026-10-14T13:00:00Z', scale: 15 }

beforeEach(() => {
  vi.clearAllMocks()
  api.getPirImageSignedUrl.mockResolvedValue(LINK)
  api.removePirImage.mockResolvedValue(undefined)
})

function renderSection(props = {}) {
  const onChanged = vi.fn()
  render(<PirImageSection pir={PIR} writer onChanged={onChanged} {...props} />)
  return { onChanged }
}

describe('PirImageSection — no image', () => {
  it('reads "No PIR image yet." and offers a writer the upload', async () => {
    const { onChanged } = renderSection()
    expect(screen.getByText(NO_IMAGE_TEXT)).toBeInTheDocument()
    expect(api.getPirImageSignedUrl).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Upload PIR image' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Upload PIR image' })).getByRole('button', { name: 'Finish upload' }))
    expect(onChanged).toHaveBeenCalled()
    expect(screen.getByText('PIR image uploaded.')).toBeInTheDocument()
  })

  it('offers a reader (a demo user) no upload', () => {
    renderSection({ writer: false })
    expect(screen.getByText(NO_IMAGE_TEXT)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('PirImageSection — an image', () => {
  it('asks for a signed URL and shows the image within the card, captioned with its scale', async () => {
    renderSection({ pir: WITH_IMAGE })
    expect(screen.getByRole('status', { name: 'Loading the PIR image' })).toBeInTheDocument()
    const image = await screen.findByRole('img', { name: 'PIR survey sheet' })
    expect(api.getPirImageSignedUrl).toHaveBeenCalledWith(WITH_IMAGE.id)
    expect(image).toHaveAttribute('src', LINK.signed_url)
    expect(image).toHaveClass('max-w-full', 'h-auto')
    expect(screen.getByText('15 px/ft')).toBeInTheDocument()
  })

  it('gives a writer Replace and Remove', async () => {
    renderSection({ pir: WITH_IMAGE })
    await screen.findByRole('img')
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it('gives a demo user the image and no actions', async () => {
    renderSection({ pir: WITH_IMAGE, writer: false })
    await screen.findByRole('img')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('replaces through the upload dialog, titled for a replacement', async () => {
    const { onChanged } = renderSection({ pir: WITH_IMAGE })
    await screen.findByRole('img')
    await userEvent.click(screen.getByRole('button', { name: 'Replace' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Replace PIR image' })).getByRole('button', { name: 'Finish upload' }))
    expect(onChanged).toHaveBeenCalled()
    expect(screen.getByText('PIR image replaced.')).toBeInTheDocument()
  })

  it('removes the image once confirmed', async () => {
    const { onChanged } = renderSection({ pir: WITH_IMAGE })
    await screen.findByRole('img')
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    const dialog = screen.getByRole('dialog', { name: 'Remove the PIR image?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(api.removePirImage).toHaveBeenCalledWith(WITH_IMAGE.id)
    expect(screen.getByText('PIR image removed.')).toBeInTheDocument()
  })

  it('shows a refused removal in its dialog', async () => {
    api.removePirImage.mockRejectedValue(new Error('PIR is deleted'))
    const { onChanged } = renderSection({ pir: WITH_IMAGE })
    await screen.findByRole('img')
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('PIR is deleted')
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('shows a failed signed URL with Retry, which asks again', async () => {
    api.getPirImageSignedUrl.mockRejectedValueOnce(Object.assign(new Error('Could not sign a URL'), { status: 502 }))
    renderSection({ pir: WITH_IMAGE })
    expect(await screen.findByText("Couldn't load the PIR image: Could not sign a URL")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('img', { name: 'PIR survey sheet' })).toBeInTheDocument()
    expect(api.getPirImageSignedUrl).toHaveBeenCalledTimes(2)
  })

  it('says so when the image went away meanwhile', async () => {
    api.getPirImageSignedUrl.mockResolvedValueOnce(null)
    renderSection({ pir: WITH_IMAGE })
    expect(await screen.findByText(/no longer has an image/)).toBeInTheDocument()
  })

  it('offers "Reload image" when the image itself fails to load, as an expired link does', async () => {
    renderSection({ pir: WITH_IMAGE })
    fireEvent.error(await screen.findByRole('img'))
    expect(screen.getByText(/its link may have expired/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reload image' }))
    expect(await screen.findByRole('img')).toBeInTheDocument()
    expect(api.getPirImageSignedUrl).toHaveBeenCalledTimes(2)
  })

  it('asks for a new link when the PIR\'s image changes', async () => {
    const { rerender } = render(<PirImageSection pir={WITH_IMAGE} writer onChanged={vi.fn()} />)
    await screen.findByRole('img')
    rerender(<PirImageSection pir={{ ...WITH_IMAGE, source_image_url: 'pirs/x/image-2.png' }} writer onChanged={vi.fn()} />)
    await waitFor(() => expect(api.getPirImageSignedUrl).toHaveBeenCalledTimes(2))
  })

  it('prints a scale with up to two decimals', () => {
    expect(scaleCaption(15)).toBe('15 px/ft')
    expect(scaleCaption(12.345)).toBe('12.35 px/ft')
  })
})
