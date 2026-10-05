import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardRef, useImperativeHandle } from 'react'
import SignatureSetupModal, { SIGNATURE_FONTS } from '../SignatureSetupModal'
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
vi.mock('../../lib/signatureImage', () => ({ drawnSignatureBlob: vi.fn(), typedSignatureBlob: vi.fn() }))

const DRAWN_BLOB = new Blob(['drawn'], { type: 'image/png' })
const TYPED_BLOB = new Blob(['typed'], { type: 'image/png' })
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
  signatureImage.typedSignatureBlob.mockResolvedValue(TYPED_BLOB)
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
    expect(screen.getAllByRole('tab').map(el => el.textContent)).toEqual(['Draw', 'Upload', 'Type'])
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

describe('SignatureSetupModal — Type tab', () => {
  const nameInput = () => screen.getByLabelText('Your name')
  const fontOption = family => screen.getByRole('radio', { name: new RegExp(`^${family}:`) })
  const preview = () => screen.getByTestId('typed-preview')
  const openTypeTab = () => userEvent.click(tab('Type'))

  it('offers four handwriting fonts', () => {
    expect(SIGNATURE_FONTS.map(f => f.family)).toEqual(['Dancing Script', 'Great Vibes', 'Satisfy', 'Caveat'])
  })

  it('starts with the user\'s name, in the first font, ready to save', async () => {
    renderModal()
    await openTypeTab()
    expect(nameInput()).toHaveValue('Genghis Khan')
    expect(fontOption('Dancing Script')).toBeChecked()
    expect(preview()).toHaveTextContent('Genghis Khan')
    expect(preview().style.fontFamily).toContain('Dancing Script')
    expect(preview().style.fontSize).toBe('48px')
    expect(saveButton()).toBeEnabled()
  })

  it('shows the typed text in every font card and in the preview as it changes', async () => {
    renderModal()
    await openTypeTab()
    await userEvent.clear(nameInput())
    await userEvent.type(nameInput(), 'G. Khan')
    expect(preview()).toHaveTextContent('G. Khan')
    for (const { id, family } of SIGNATURE_FONTS) {
      const sample = screen.getByTestId(`font-sample-${id}`)
      expect(sample).toHaveTextContent('G. Khan')
      expect(sample.style.fontFamily).toContain(family)
    }
  })

  it('switches the preview to the font that is picked', async () => {
    renderModal()
    await openTypeTab()
    await userEvent.click(fontOption('Satisfy'))
    expect(fontOption('Satisfy')).toBeChecked()
    expect(fontOption('Dancing Script')).not.toBeChecked()
    expect(preview().style.fontFamily).toContain('Satisfy')
  })

  it('lets the font be picked from the keyboard: one radio group, moved through with the arrow keys', async () => {
    renderModal()
    await openTypeTab()
    const group = screen.getByRole('group', { name: 'Style' })
    const radios = within(group).getAllByRole('radio')
    expect(radios).toHaveLength(4)
    expect(new Set(radios.map(r => r.name)).size).toBe(1)
    fontOption('Dancing Script').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(fontOption('Great Vibes')).toBeChecked()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(fontOption('Caveat')).toBeChecked()
    expect(preview().style.fontFamily).toContain('Caveat')
    await userEvent.keyboard('{ArrowUp}')
    expect(fontOption('Satisfy')).toBeChecked()
  })

  it('disables Save while the name is blank or only spaces', async () => {
    renderModal()
    await openTypeTab()
    await userEvent.clear(nameInput())
    expect(saveButton()).toBeDisabled()
    expect(screen.getByTestId('font-sample-caveat')).toHaveTextContent('Your name') // a sample still shows the style
    await userEvent.type(nameInput(), '   ')
    expect(saveButton()).toBeDisabled()
    await userEvent.type(nameInput(), 'G')
    expect(saveButton()).toBeEnabled()
  })

  it('starts blank for a user with no name on file', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { ...TEST_USER, first_name: null, last_name: null }, refreshUser,
    })
    render(<SignatureSetupModal isOpen onClose={vi.fn()} />)
    await openTypeTab()
    expect(nameInput()).toHaveValue('')
    expect(nameInput()).toHaveAttribute('placeholder', 'Your full name')
    expect(saveButton()).toBeDisabled()
  })

  it('saves the name rendered in the chosen font, through the same upload as a drawing', async () => {
    const { onClose, onSuccess } = renderModal()
    await openTypeTab()
    await userEvent.clear(nameInput())
    await userEvent.type(nameInput(), 'Genghis K.')
    await userEvent.click(fontOption('Great Vibes'))
    await userEvent.click(saveButton())
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(signatureImage.typedSignatureBlob).toHaveBeenCalledWith('Genghis K.', 'Great Vibes')
    expect(api.saveSignature).toHaveBeenCalledWith(TYPED_BLOB, 'drawn') // pixels, like a drawing
    expect(signatureImage.drawnSignatureBlob).not.toHaveBeenCalled()
    expect(refreshUser).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('shows why inline, and stays open, when the font cannot be loaded', async () => {
    signatureImage.typedSignatureBlob.mockRejectedValue(
      new Error('The signature font could not be loaded. Check your connection and try again.'))
    const { onClose } = renderModal()
    await openTypeTab()
    await userEvent.click(saveButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('The signature font could not be loaded.')
    expect(api.saveSignature).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps what was typed and drawn when moving between tabs', async () => {
    renderModal()
    await draw()
    await openTypeTab()
    await userEvent.clear(nameInput())
    await userEvent.type(nameInput(), 'Khan')
    await userEvent.click(tab('Draw'))
    expect(saveButton()).toBeEnabled()
    await openTypeTab()
    expect(nameInput()).toHaveValue('Khan')
  })

  it('locks the name and the fonts while saving', async () => {
    let finish
    api.saveSignature.mockReturnValue(new Promise(resolve => { finish = resolve }))
    renderModal()
    await openTypeTab()
    await userEvent.click(saveButton())
    expect(nameInput()).toBeDisabled()
    expect(fontOption('Caveat')).toBeDisabled()
    await act(async () => finish({}))
  })
})
