import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardRef, useImperativeHandle } from 'react'
import SignatureSetupModal from '../SignatureSetupModal'
import * as AuthContext from '../../contexts/AuthContext'
import * as api from '../../services/api'
import * as signatureImage from '../../lib/signatureImage'
import { TEST_USER } from '../../test/users'

// The drawing surface needs a real canvas; here it is a stand-in with a button that "draws"
const canvasApi = { clear: vi.fn(), getCanvas: vi.fn(() => ({ fake: 'canvas' })) }
vi.mock('react-signature-canvas', () => ({
  default: forwardRef(function FakeSignatureCanvas({ onEnd, canvasProps }, ref) {
    useImperativeHandle(ref, () => canvasApi)
    return <button type="button" aria-label={canvasProps['aria-label']} onClick={onEnd}>canvas</button>
  }),
}))

vi.mock('../../services/api', () => ({ saveSignature: vi.fn(), validateSignatureFile: vi.fn() }))
vi.mock('../../lib/signatureImage', () => ({ drawnSignatureBlob: vi.fn() }))

const DRAWN_BLOB = new Blob(['drawn'], { type: 'image/png' })
const png = (name = 'signature.png') => new File(['png-bytes'], name, { type: 'image/png' })

let refreshUser

function renderModal(props = {}) {
  const handlers = { onClose: vi.fn(), onSuccess: vi.fn() }
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: TEST_USER, refreshUser })
  const view = render(<SignatureSetupModal isOpen {...handlers} {...props} />)
  return { ...handlers, ...view }
}

const saveButton = () => screen.getByRole('button', { name: /^(save|saving)/i })
const tab = name => screen.getByRole('tab', { name })
const canvas = () => screen.getByRole('button', { name: 'Draw your signature here' })
const fileInput = () => screen.getByLabelText(/signature image|choose a different png/i)
const draw = () => userEvent.click(canvas())

beforeEach(() => {
  vi.clearAllMocks()
  refreshUser = vi.fn().mockResolvedValue({ ...TEST_USER, has_signature: true })
  api.saveSignature.mockResolvedValue({ ...TEST_USER, has_signature: true })
  api.validateSignatureFile.mockImplementation(file => (file.type === 'image/png' ? null : 'The signature must be a PNG image.'))
  signatureImage.drawnSignatureBlob.mockResolvedValue(DRAWN_BLOB)
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

describe('SignatureSetupModal — frame', () => {
  it('renders nothing while closed', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: TEST_USER, refreshUser })
    render(<SignatureSetupModal isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens as "Set Up Your Signature" on the Draw tab, with Save disabled', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Set Up Your Signature' })).toBeInTheDocument()
    expect(tab('Draw')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Upload')).toHaveAttribute('aria-selected', 'false')
    expect(canvas()).toBeVisible()
    expect(saveButton()).toBeDisabled()
  })

  it('takes another title for updating', () => {
    renderModal({ title: 'Update Your Signature' })
    expect(screen.getByRole('dialog', { name: 'Update Your Signature' })).toBeInTheDocument()
  })

  it('Cancel closes without saving', async () => {
    const { onClose, onSuccess } = renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSuccess).not.toHaveBeenCalled()
    expect(api.saveSignature).not.toHaveBeenCalled()
  })

  it('starts blank again each time it is opened', async () => {
    const { rerender, onClose } = renderModal()
    await draw()
    expect(saveButton()).toBeEnabled()
    rerender(<SignatureSetupModal isOpen={false} onClose={onClose} />)
    rerender(<SignatureSetupModal isOpen onClose={onClose} />)
    expect(saveButton()).toBeDisabled()
  })
})

describe('SignatureSetupModal — Draw tab', () => {
  it('enables Save once something is drawn', async () => {
    renderModal()
    await draw()
    expect(saveButton()).toBeEnabled()
  })

  it('Clear wipes the canvas and disables Save again', async () => {
    renderModal()
    const clear = screen.getByRole('button', { name: 'Clear' })
    expect(clear).toBeDisabled()
    await draw()
    await userEvent.click(clear)
    expect(canvasApi.clear).toHaveBeenCalledTimes(1)
    expect(saveButton()).toBeDisabled()
  })

  it('saves the drawing as a "drawn" signature, refreshes the user, then reports success and closes', async () => {
    const order = []
    refreshUser.mockImplementation(async () => { order.push('refresh') })
    const { onClose, onSuccess } = renderModal()
    onSuccess.mockImplementation(() => order.push('success'))
    onClose.mockImplementation(() => order.push('close'))
    await draw()
    await userEvent.click(saveButton())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(signatureImage.drawnSignatureBlob).toHaveBeenCalledWith({ fake: 'canvas' })
    expect(api.saveSignature).toHaveBeenCalledWith(DRAWN_BLOB, 'drawn')
    expect(order).toEqual(['refresh', 'success', 'close'])
  })

  it('shows a spinner on Save and locks the dialog while saving', async () => {
    let finish
    api.saveSignature.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const { onClose } = renderModal()
    await draw()
    await userEvent.click(saveButton())
    expect(saveButton()).toBeDisabled()
    expect(saveButton()).toHaveTextContent('Saving...')
    expect(saveButton().querySelector('[role="status"]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(tab('Upload')).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => finish({}))
  })

  it('says so when the canvas turned out blank, and stays open', async () => {
    signatureImage.drawnSignatureBlob.mockRejectedValue(new Error('Draw your signature first.'))
    const { onClose } = renderModal()
    await draw()
    await userEvent.click(saveButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your signature: Draw your signature first.')
    expect(api.saveSignature).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('SignatureSetupModal — Upload tab', () => {
  it('takes a PNG, previews it and enables Save', async () => {
    renderModal()
    await userEvent.click(tab('Upload'))
    expect(fileInput()).toHaveAttribute('accept', 'image/png')
    expect(saveButton()).toBeDisabled()
    await userEvent.upload(fileInput(), png())
    expect(screen.getByRole('img', { name: 'Signature preview' })).toHaveAttribute('src', 'blob:preview')
    expect(saveButton()).toBeEnabled()
  })

  it('rejects a file that is not a PNG with an inline error, and keeps Save disabled', async () => {
    renderModal()
    await userEvent.click(tab('Upload'))
    const jpeg = new File(['x'], 'signature.jpg', { type: 'image/jpeg' })
    // applyAccept: false, so the non-PNG reaches the component as it would from a drag-and-drop
    await userEvent.setup({ applyAccept: false }).upload(fileInput(), jpeg)
    expect(screen.getByRole('alert')).toHaveTextContent('The signature must be a PNG image.')
    expect(screen.queryByRole('img', { name: 'Signature preview' })).not.toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  it('lets the user pick a different file, replacing the preview and clearing the error', async () => {
    renderModal()
    await userEvent.click(tab('Upload'))
    await userEvent.setup({ applyAccept: false }).upload(fileInput(), new File(['x'], 'a.jpg', { type: 'image/jpeg' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await userEvent.upload(fileInput(), png('second.png'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Signature preview' })).toBeInTheDocument()
    expect(screen.getByLabelText('Choose a different PNG')).toBeInTheDocument()
  })

  it('saves the chosen file as an "uploaded" signature', async () => {
    const { onClose, onSuccess } = renderModal()
    await userEvent.click(tab('Upload'))
    const file = png()
    await userEvent.upload(fileInput(), file)
    await userEvent.click(saveButton())
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(api.saveSignature).toHaveBeenCalledWith(file, 'uploaded')
    expect(signatureImage.drawnSignatureBlob).not.toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('keeps the drawing when the user looks at the Upload tab and comes back', async () => {
    renderModal()
    await draw()
    await userEvent.click(tab('Upload'))
    expect(saveButton()).toBeDisabled() // nothing chosen on this tab
    await userEvent.click(tab('Draw'))
    expect(saveButton()).toBeEnabled()
  })
})

describe('SignatureSetupModal — failures', () => {
  it.each([
    ['the upload request fails', 'Internal Server Error'],
    ['Storage rejects the file', 'File storage rejected the signature (HTTP 400). Please try again.'],
    ['the network is down', 'Could not reach file storage. Please try again.'],
    ['confirm fails', 'Upload the signature before confirming'],
    ['a demo user gets this far', 'Demo mode: signatures are not available'],
  ])('shows the reason inline and stays open when %s', async (_, message) => {
    api.saveSignature.mockRejectedValue(new Error(message))
    const { onClose, onSuccess } = renderModal()
    await draw()
    await userEvent.click(saveButton())
    expect(await screen.findByRole('alert')).toHaveTextContent(`Could not save your signature: ${message}`)
    expect(onClose).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(refreshUser).not.toHaveBeenCalled()
    expect(saveButton()).toBeEnabled() // ready for another try
  })

  it('clears the error on the next attempt, which can then succeed', async () => {
    api.saveSignature.mockRejectedValueOnce(new Error('Internal Server Error')).mockResolvedValueOnce({})
    const { onClose } = renderModal()
    await draw()
    await userEvent.click(saveButton())
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await userEvent.click(saveButton())
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('still counts as saved when only the user refresh fails afterwards', async () => {
    refreshUser.mockRejectedValue(new Error('Failed to fetch'))
    const { onClose, onSuccess } = renderModal()
    await draw()
    await userEvent.click(saveButton())
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
