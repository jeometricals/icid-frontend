import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PirFormModal, { MAX_INITIALS_LENGTH, PIR_TAKEN } from '../PirFormModal'

const PIR = { id: 'e0000000-0000-4000-8000-000000000001', inspector_initials: 'JD', inspector_sign_date: '2026-09-14' }

function renderModal(props = {}) {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  render(<PirFormModal onSave={onSave} onCancel={onCancel} {...props} />)
  return { onSave, onCancel }
}

const initials = () => screen.getByLabelText('Inspector initials')
const signDate = () => screen.getByLabelText('Inspector sign date')
const saveButton = () => screen.getByRole('button', { name: 'Save' })
const failure = (status, message, body = {}) => Object.assign(new Error(message), { status, body })

describe('PirFormModal — adding', () => {
  it('opens empty, titled "Add PIR", with Save off', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Add PIR' })).toBeInTheDocument()
    expect(initials()).toHaveDisplayValue('')
    expect(initials()).toHaveAttribute('maxLength', String(MAX_INITIALS_LENGTH))
    expect(signDate()).toHaveAttribute('type', 'date')
    expect(saveButton()).toBeDisabled()
  })

  it('needs both fields', async () => {
    renderModal()
    await userEvent.type(initials(), 'JD')
    expect(saveButton()).toBeDisabled()
    await userEvent.clear(initials())
    await userEvent.type(initials(), '   ')
    await userEvent.type(signDate(), '2026-09-14')
    expect(saveButton()).toBeDisabled()
  })

  it('passes on both, the initials trimmed', async () => {
    const { onSave } = renderModal()
    await userEvent.type(initials(), ' JD ')
    await userEvent.type(signDate(), '2026-09-14')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ inspector_initials: 'JD', inspector_sign_date: '2026-09-14' })
  })
})

describe('PirFormModal — editing', () => {
  it('opens pre-filled, titled "Edit PIR", with Save off until something changes', async () => {
    renderModal({ mode: 'edit', initial: PIR })
    expect(screen.getByRole('dialog', { name: 'Edit PIR' })).toBeInTheDocument()
    expect(initials()).toHaveDisplayValue('JD')
    expect(signDate()).toHaveValue('2026-09-14')
    expect(saveButton()).toBeDisabled()
    await userEvent.type(initials(), ' ')
    expect(saveButton()).toBeDisabled() // trimmed, it is the same
  })

  it('passes on only what changed', async () => {
    const { onSave } = renderModal({ mode: 'edit', initial: PIR })
    await userEvent.clear(initials())
    await userEvent.type(initials(), 'JQD')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ inspector_initials: 'JQD' })
  })

  it('keeps Save off when a field is emptied', async () => {
    renderModal({ mode: 'edit', initial: PIR })
    await userEvent.clear(signDate())
    expect(saveButton()).toBeDisabled()
  })
})

describe('PirFormModal — refusals', () => {
  it('says a 409 below the form', () => {
    renderModal({ error: failure(409, 'This property already has a PIR', { existing_pir_id: 'x' }) })
    expect(screen.getByRole('alert')).toHaveTextContent(PIR_TAKEN)
    expect(initials()).toHaveAttribute('aria-invalid', 'false')
  })

  it('says a 400 as the backend worded it', () => {
    renderModal({ error: failure(400, 'inspector_initials is too long') })
    expect(screen.getByRole('alert')).toHaveTextContent('inspector_initials is too long')
  })

  it('puts a 422 under the field it names', () => {
    renderModal({ error: failure(422, 'x', { detail: [{ loc: ['body', 'inspector_sign_date'], msg: 'Input should be a valid date' }] }) })
    expect(signDate()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'pir-inspector_sign_date-error')
  })

  it('locks the form while saving', () => {
    renderModal({ busy: true })
    expect(initials()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
  })
})
