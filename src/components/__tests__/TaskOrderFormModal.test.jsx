import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskOrderFormModal, {
  ESTIMATE_PLACEHOLDER, MAX_ESTIMATE_NOTES_LENGTH, MAX_NUMBER_LENGTH, NUMBER_TAKEN,
} from '../TaskOrderFormModal'

const TASK_ORDER = { id: 'd0000000-0000-4000-8000-000000000001', project_id: 'HWS0023', task_order_number: 'TO-001',
  issued_date: '2026-09-14', estimate_notes: '4" SF 1200', created_at: '2026-09-14T12:00:00Z' }

function renderModal(props = {}) {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  render(<TaskOrderFormModal onSave={onSave} onCancel={onCancel} {...props} />)
  return { onSave, onCancel }
}

const number = () => screen.getByLabelText('Number')
const issued = () => screen.getByLabelText(/Issued date/)
const notes = () => screen.getByLabelText(/Estimate notes/)
const saveButton = () => screen.getByRole('button', { name: 'Save' })
const failure = (status, message, body = {}) => Object.assign(new Error(message), { status, body })

describe('TaskOrderFormModal — adding', () => {
  it('opens empty, titled "Add task order", with Save off', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Add task order' })).toBeInTheDocument()
    expect(number()).toHaveDisplayValue('')
    expect(issued()).toHaveAttribute('type', 'date')
    expect(notes()).toHaveAttribute('placeholder', ESTIMATE_PLACEHOLDER)
    expect(number()).toHaveAttribute('maxLength', String(MAX_NUMBER_LENGTH))
    expect(notes()).toHaveAttribute('maxLength', String(MAX_ESTIMATE_NOTES_LENGTH))
    expect(saveButton()).toBeDisabled()
  })

  it('needs only the number, and passes on all three with blanks as null', async () => {
    const { onSave } = renderModal()
    await userEvent.type(number(), '   ')
    expect(saveButton()).toBeDisabled()
    await userEvent.type(number(), 'TO-002 ')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ task_order_number: 'TO-002', issued_date: null, estimate_notes: null })
  })

  it('passes on a date and notes when given', async () => {
    const { onSave } = renderModal()
    await userEvent.type(number(), 'TO-002')
    await userEvent.type(issued(), '2026-10-01')
    await userEvent.type(notes(), 'curb 300 LF')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ task_order_number: 'TO-002', issued_date: '2026-10-01', estimate_notes: 'curb 300 LF' })
  })
})

describe('TaskOrderFormModal — editing', () => {
  it('opens pre-filled, titled "Edit task order", with Save off until something changes', () => {
    renderModal({ mode: 'edit', initial: TASK_ORDER })
    expect(screen.getByRole('dialog', { name: 'Edit task order' })).toBeInTheDocument()
    expect(number()).toHaveDisplayValue('TO-001')
    expect(issued()).toHaveValue('2026-09-14')
    expect(notes()).toHaveDisplayValue('4" SF 1200')
    expect(saveButton()).toBeDisabled()
  })

  it('passes on only what changed, a cleared date as null', async () => {
    const { onSave } = renderModal({ mode: 'edit', initial: TASK_ORDER })
    await userEvent.clear(issued())
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ issued_date: null })
  })

  it('starts empty where the task order has nothing', () => {
    renderModal({ mode: 'edit', initial: { ...TASK_ORDER, issued_date: null, estimate_notes: null } })
    expect(issued()).toHaveValue('')
    expect(notes()).toHaveDisplayValue('')
  })
})

describe('TaskOrderFormModal — refusals', () => {
  it('shows a taken number under the Number field', () => {
    renderModal({ error: failure(409, 'A task order with this number already exists in this project') })
    expect(screen.getByRole('alert')).toHaveTextContent(NUMBER_TAKEN)
    expect(number()).toHaveAttribute('aria-invalid', 'true')
    expect(number()).toHaveAttribute('aria-describedby', 'task-order-task_order_number-error')
  })

  it('puts a malformed date\'s 422 under the date', () => {
    renderModal({ error: failure(422, 'x', { detail: [{ loc: ['body', 'issued_date'], msg: 'Input should be a valid date' }] }) })
    expect(issued()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Input should be a valid date')
  })

  it('says any other refusal below the form', () => {
    renderModal({ error: failure(400, 'task_order_number is too long') })
    expect(screen.getByRole('alert')).toHaveTextContent('task_order_number is too long')
    expect(number()).toHaveAttribute('aria-invalid', 'false')
  })
})
