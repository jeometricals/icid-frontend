import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PropertyFormModal, {
  BBL_TAKEN, MAX_ADDRESS_LENGTH, MAX_BBL_LENGTH, MAX_NOTES_LENGTH,
} from '../PropertyFormModal'

const PROPERTY = { id: 'c0000000-0000-4000-8000-000000000001', project_id: 'HWS0023', bbl: '4001230045',
  address: '12 Main St', property_type: '1_3_family', notes: 'Corner lot', created_at: '2026-09-14T12:00:00Z' }

function renderModal(props = {}) {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  const view = render(<PropertyFormModal onSave={onSave} onCancel={onCancel} {...props} />)
  return { onSave, onCancel, ...view }
}

const bbl = () => screen.getByLabelText('BBL')
const address = () => screen.getByLabelText('Address')
const type = () => screen.getByLabelText('Site type')
const notes = () => screen.getByLabelText(/Notes/)
const saveButton = () => screen.getByRole('button', { name: 'Save' })

async function fill({ bblText = '4001230045', addressText = '12 Main St', typeValue = '4_plus_family' } = {}) {
  if (bblText) await userEvent.type(bbl(), bblText)
  if (addressText) await userEvent.type(address(), addressText)
  if (typeValue) await userEvent.selectOptions(type(), typeValue)
}

describe('PropertyFormModal — adding', () => {
  it('opens empty, titled "Add site", with Save off', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Add site' })).toBeInTheDocument()
    expect(bbl()).toHaveDisplayValue('')
    expect(address()).toHaveDisplayValue('')
    expect(type()).toHaveValue('')
    expect(notes()).toHaveDisplayValue('')
    expect(saveButton()).toBeDisabled()
  })

  it('caps each text field at what the backend takes', () => {
    renderModal()
    expect(bbl()).toHaveAttribute('maxLength', String(MAX_BBL_LENGTH))
    expect(address()).toHaveAttribute('maxLength', String(MAX_ADDRESS_LENGTH))
    expect(notes()).toHaveAttribute('maxLength', String(MAX_NOTES_LENGTH))
    expect(notes().tagName).toBe('TEXTAREA')
  })

  it('offers the three property types by their human labels', () => {
    renderModal()
    const options = within(type()).getAllByRole('option').filter(option => !option.disabled)
    expect(options.map(option => [option.value, option.textContent])).toEqual([
      ['1_3_family', '1-3 family'],
      ['4_plus_family', '4+ family / commercial'],
      ['expedited', 'Expedited'],
    ])
  })

  it.each([
    ['BBL', { bblText: '' }],
    ['address', { addressText: '' }],
    ['property type', { typeValue: '' }],
    ['BBL (spaces only)', { bblText: '   ' }],
  ])('keeps Save off without a %s', async (_, missing) => {
    renderModal()
    await fill(missing)
    expect(saveButton()).toBeDisabled()
  })

  it('passes on all four, trimmed, with blank notes as null', async () => {
    const { onSave } = renderModal()
    await fill({ bblText: ' 4001230045 ', addressText: ' 12 Main St ' })
    await userEvent.type(notes(), '   ')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({
      bbl: '4001230045', address: '12 Main St', property_type: '4_plus_family', notes: null,
    })
  })

  it('passes on notes when there are some', async () => {
    const { onSave } = renderModal()
    await fill()
    await userEvent.type(notes(), 'Corner lot')
    await userEvent.click(saveButton())
    expect(onSave.mock.calls[0][0].notes).toBe('Corner lot')
  })
})

describe('PropertyFormModal — editing', () => {
  it('opens pre-filled, titled "Edit site", with Save off until something changes', async () => {
    renderModal({ mode: 'edit', initial: PROPERTY })
    expect(screen.getByRole('dialog', { name: 'Edit site' })).toBeInTheDocument()
    expect(bbl()).toHaveDisplayValue('4001230045')
    expect(address()).toHaveDisplayValue('12 Main St')
    expect(type()).toHaveValue('1_3_family')
    expect(notes()).toHaveDisplayValue('Corner lot')
    expect(saveButton()).toBeDisabled()
    await userEvent.type(address(), ' ')
    expect(saveButton()).toBeDisabled() // trimmed, it is the same
  })

  it('passes on only what changed', async () => {
    const { onSave } = renderModal({ mode: 'edit', initial: PROPERTY })
    await userEvent.clear(address())
    await userEvent.type(address(), '14 Main St')
    await userEvent.selectOptions(type(), 'expedited')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ address: '14 Main St', property_type: 'expedited' })
  })

  it('sends cleared notes as null', async () => {
    const { onSave } = renderModal({ mode: 'edit', initial: PROPERTY })
    await userEvent.clear(notes())
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ notes: null })
  })

  it('keeps Save off when a required field is emptied', async () => {
    renderModal({ mode: 'edit', initial: PROPERTY })
    await userEvent.clear(bbl())
    expect(saveButton()).toBeDisabled()
  })
})

describe('PropertyFormModal — refusals', () => {
  const failure = (status, message, body = {}) => Object.assign(new Error(message), { status, body })

  it('shows a taken BBL above the BBL field', () => {
    renderModal({ error: failure(409, 'A property with this BBL already exists in this project', { existing_property_id: 'x' }) })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(BBL_TAKEN)
    expect(alert.compareDocumentPosition(bbl()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(bbl()).toHaveAttribute('aria-invalid', 'true')
  })

  it('puts a 422\'s messages under the fields they name', () => {
    renderModal({ error: failure(422, 'x', { detail: [
      { loc: ['body', 'property_type'], msg: 'Input should be \'1_3_family\', \'4_plus_family\' or \'expedited\'' },
      { loc: ['body', 'address'], msg: 'Field required' },
    ] }) })
    expect(type()).toHaveAttribute('aria-invalid', 'true')
    expect(address()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Field required')).toHaveAttribute('id', 'property-address-error')
    expect(screen.getByText(/Input should be/)).toHaveAttribute('id', 'property-property_type-error')
  })

  it('says any other refusal as the backend worded it, below the form', () => {
    renderModal({ error: failure(400, 'bbl is too long') })
    expect(screen.getByRole('alert')).toHaveTextContent('bbl is too long')
    expect(bbl()).toHaveAttribute('aria-invalid', 'false')
  })

  it('locks the form while saving', () => {
    renderModal({ busy: true })
    expect(bbl()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
  })

  it('cancels', async () => {
    const { onCancel } = renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
