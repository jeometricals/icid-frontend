import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PayItemFormModal, {
  MAX_BUDGET_CODE_LENGTH, MAX_PAY_ITEM_DESCRIPTION_LENGTH, MAX_PAY_ITEM_REF_LENGTH, MAX_UNIT_LENGTH,
} from '../PayItemFormModal'

const ITEM = { pay_item_uuid: 'b0000000-0000-4000-8000-000000000001', pay_item_ref: '4.13 AAS',
  description: '4" concrete sidewalk', unit: 'SF', quantity: 12500, unit_price: 9.5, budget_code: 'HW0001Q-CONS',
  spec_section: null }

function renderModal(props = {}) {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  render(<PayItemFormModal onSave={onSave} onCancel={onCancel} {...props} />)
  return { onSave, onCancel }
}

const ref = () => screen.getByLabelText('Pay Item Ref')
const budgetCode = () => screen.getByLabelText('Budget Code')
const description = () => screen.getByLabelText('Description')
const unit = () => screen.getByLabelText('Unit')
const quantity = () => screen.getByLabelText('Quantity')
const unitPrice = () => screen.getByLabelText('Unit Price')
const fields = () => [ref(), budgetCode(), description(), unit(), quantity(), unitPrice()]
const saveButton = () => screen.getByRole('button', { name: 'Save' })

const FILLED = { refText: '6.02', budgetText: 'EP0007-CONS', descriptionText: 'Steel faced curb', unitText: 'LF',
  quantityText: '171.5', priceText: '42.25' }

async function fill(overrides = {}) {
  const typed = { ...FILLED, ...overrides }
  if (typed.refText) await userEvent.type(ref(), typed.refText)
  if (typed.budgetText) await userEvent.type(budgetCode(), typed.budgetText)
  if (typed.descriptionText) await userEvent.type(description(), typed.descriptionText)
  if (typed.unitText) await userEvent.type(unit(), typed.unitText)
  if (typed.quantityText) await userEvent.type(quantity(), typed.quantityText)
  if (typed.priceText) await userEvent.type(unitPrice(), typed.priceText)
}

describe('PayItemFormModal — adding', () => {
  it('opens empty, with all six fields and Save off', () => {
    renderModal({ mode: 'add' })
    expect(screen.getByRole('dialog', { name: 'Add Pay Item' })).toBeInTheDocument()
    for (const input of fields()) expect(input).toHaveDisplayValue('')
    expect(saveButton()).toBeDisabled()
  })

  it('caps each text field at what the backend takes, and makes the amounts numbers from zero up', () => {
    renderModal()
    expect(ref()).toHaveAttribute('maxLength', String(MAX_PAY_ITEM_REF_LENGTH))
    expect(budgetCode()).toHaveAttribute('maxLength', String(MAX_BUDGET_CODE_LENGTH))
    expect(description()).toHaveAttribute('maxLength', String(MAX_PAY_ITEM_DESCRIPTION_LENGTH))
    expect(description().tagName).toBe('TEXTAREA')
    expect(description()).toHaveAttribute('rows', '3')
    expect(unit()).toHaveAttribute('maxLength', String(MAX_UNIT_LENGTH))
    for (const [input, step] of [[quantity(), '0.001'], [unitPrice(), '0.01']]) {
      expect(input).toHaveAttribute('type', 'number')
      expect(input).toHaveAttribute('min', '0')
      expect(input).toHaveAttribute('step', step)
    }
  })

  it('gives the hints', () => {
    renderModal()
    expect(ref()).toHaveAccessibleDescription('e.g. 4.13 AAS or UTL-6.01.1.')
    expect(budgetCode()).toHaveAccessibleDescription('e.g. EP0007-CONS or HW0001Q-CONS.')
    expect(unit()).toHaveAccessibleDescription('LF, SF, SY, EA, CY, TN, LS, FS, MONTH, HR, LB.')
    expect(screen.getByText('$')).toBeInTheDocument()
  })

  it.each([
    ['the ref', { refText: '' }],
    ['the budget code', { budgetText: '' }],
    ['the description', { descriptionText: '' }],
    ['the unit', { unitText: '' }],
    ['the quantity', { quantityText: '' }],
    ['the unit price', { priceText: '' }],
    ['a ref that isn\'t only spaces', { refText: '   ' }],
    ['a quantity that isn\'t negative', { quantityText: '-1' }],
    ['a unit price that isn\'t negative', { priceText: '-0.01' }],
  ])('keeps Save off without %s', async (_, overrides) => {
    renderModal()
    await fill(overrides)
    expect(saveButton()).toBeDisabled()
  })

  it('turns Save on once all six are in, zero amounts included', async () => {
    renderModal()
    await fill({ quantityText: '0', priceText: '0' })
    expect(saveButton()).toBeEnabled()
  })

  it('puts the unit in capitals when its field is left', async () => {
    renderModal()
    await userEvent.type(unit(), 'month')
    expect(unit()).toHaveValue('month')
    await userEvent.tab()
    expect(unit()).toHaveValue('MONTH')
  })

  it('passes on the text trimmed, the unit in capitals and the amounts as numbers', async () => {
    const { onSave } = renderModal()
    await fill({ refText: ' 6.02 ', budgetText: ' EP0007-CONS ', descriptionText: ' Steel faced curb ', unitText: 'lf' })
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ pay_item_ref: '6.02', budget_code: 'EP0007-CONS',
      description: 'Steel faced curb', unit: 'LF', quantity: 171.5, unit_price: 42.25 })
  })

  it('shows a collision inline and keeps what was typed', async () => {
    const { rerender } = render(<PayItemFormModal onSave={() => {}} onCancel={() => {}} />)
    await fill()
    rerender(<PayItemFormModal onSave={() => {}} onCancel={() => {}}
      error="A pay item with this ref and budget code already exists for this project" />)
    expect(screen.getByRole('alert'))
      .toHaveTextContent('A pay item with this ref and budget code already exists for this project')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(ref()).toHaveValue('6.02')
    expect(budgetCode()).toHaveValue('EP0007-CONS')
    expect(description()).toHaveValue('Steel faced curb')
    expect(unit()).toHaveValue('LF')
    expect(quantity()).toHaveValue(171.5)
    expect(unitPrice()).toHaveValue(42.25)
    expect(saveButton()).toBeEnabled()
  })

  it('locks itself while the save runs', () => {
    renderModal({ busy: true })
    for (const input of fields()) expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('cancels without saving', async () => {
    const { onSave, onCancel } = renderModal()
    await fill()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })
})

describe('PayItemFormModal — editing', () => {
  it('opens with the item\'s values filled in and Save on', () => {
    renderModal({ mode: 'edit', initial: ITEM })
    expect(screen.getByRole('dialog', { name: 'Edit Pay Item' })).toBeInTheDocument()
    expect(ref()).toHaveValue('4.13 AAS')
    expect(budgetCode()).toHaveValue('HW0001Q-CONS')
    expect(description()).toHaveValue('4" concrete sidewalk')
    expect(unit()).toHaveValue('SF')
    expect(quantity()).toHaveValue(12500)
    expect(unitPrice()).toHaveValue(9.5)
    expect(saveButton()).toBeEnabled()
  })

  it('passes on all six fields, with what was changed', async () => {
    const { onSave } = renderModal({ mode: 'edit', initial: ITEM })
    await userEvent.clear(quantity())
    await userEvent.type(quantity(), '13000')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ pay_item_ref: '4.13 AAS', budget_code: 'HW0001Q-CONS',
      description: '4" concrete sidewalk', unit: 'SF', quantity: 13000, unit_price: 9.5 })
  })

  it('turns Save off when a field is emptied', async () => {
    renderModal({ mode: 'edit', initial: ITEM })
    await userEvent.clear(description())
    expect(saveButton()).toBeDisabled()
  })
})
