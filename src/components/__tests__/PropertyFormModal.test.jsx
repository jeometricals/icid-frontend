import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PropertyFormModal, {
  BLOCK_HINT, BLOCK_INVALID, BLOCK_LOT_TAKEN, FACING_HINT, LOT_HINT, LOT_INVALID, MAX_ADDRESS_LENGTH, MAX_NOTES_LENGTH,
  MAX_STREET_LENGTH, MAX_VIOLATION_LENGTH,
} from '../PropertyFormModal'

const SIDEWALK = { id: 'c0000000-0000-4000-8000-000000000001', project_id: 'HWS0023', kind: 'sidewalk', boro: 'Queens',
  block: '123', lot: '45', address: '12 Main St', property_type: '1_3_family', violation_no: 'V-1', notes: 'Corner lot',
  created_at: '2026-09-14T12:00:00Z' }
const RAMP = { id: 'c0000000-0000-4000-8000-000000000002', project_id: 'HWS0023', kind: 'ped_ramp', boro: 'Brooklyn',
  block: null, lot: null, address: null, property_type: null, violation_no: null, intersection_street_1: 'Atlantic Ave',
  intersection_street_2: 'Court St', quadrant: 'NE', facing_street: 'street_2', ramp_type: 'PERPENDICULAR' }

function renderModal(props = {}) {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  const view = render(<PropertyFormModal onSave={onSave} onCancel={onCancel} {...props} />)
  return { onSave, onCancel, ...view }
}

const field = (label) => screen.getByLabelText(label)
const borough = () => field('Borough')
const block = () => field('Block')
const lot = () => field('Lot')
const address = () => field('Address')
const violation = () => field(/Violation No\./)
const type = () => field('Property type')
const notes = () => field(/Notes/)
const saveButton = () => screen.getByRole('button', { name: 'Save' })
const enabledOptions = (select) => within(select).getAllByRole('option').filter(option => !option.disabled)
// The form's fields, in order, by their labels
const fieldOrder = () => Array.from(document.querySelectorAll('#property-form label')).map(label => label.textContent)

async function fillSidewalk({
  boro = 'Queens', blockText = '123', lotText = '45', addressText = '12 Main St', typeValue = '4_plus_family',
} = {}) {
  if (boro) await userEvent.selectOptions(borough(), boro)
  if (blockText) await userEvent.type(block(), blockText)
  if (lotText) await userEvent.type(lot(), lotText)
  if (addressText) await userEvent.type(address(), addressText)
  if (typeValue) await userEvent.selectOptions(type(), typeValue)
}

async function fillRamp({ street1 = 'Main St', street2 = '37th Ave', facing = 'street_2' } = {}) {
  await userEvent.selectOptions(borough(), 'Queens')
  if (street1) await userEvent.type(field('Intersection 1st Street'), street1)
  if (street2) await userEvent.type(field('Intersection 2nd Street'), street2)
  await userEvent.selectOptions(field('Quadrant'), 'SE')
  if (facing) await userEvent.selectOptions(field('Facing'), facing)
  await userEvent.selectOptions(field('Type'), 'CUT_THROUGH')
}

describe('PropertyFormModal — adding a sidewalk', () => {
  it('opens empty, titled "Add sidewalk", with Save off and no kind line', () => {
    renderModal({ kind: 'sidewalk' })
    expect(screen.getByRole('dialog', { name: 'Add sidewalk' })).toBeInTheDocument()
    expect(screen.queryByText(/Site type:/)).not.toBeInTheDocument()
    expect(borough()).toHaveValue('')
    expect(block()).toHaveDisplayValue('')
    expect(lot()).toHaveDisplayValue('')
    expect(address()).toHaveDisplayValue('')
    expect(type()).toHaveValue('')
    expect(notes()).toHaveDisplayValue('')
    expect(saveButton()).toBeDisabled()
  })

  it('asks Borough, Block, Lot, CB, Address, Violation No., Property type and Notes, in that order, and no BBL', () => {
    renderModal({ kind: 'sidewalk' })
    expect(fieldOrder()).toEqual(['Borough', 'Block', 'Lot', 'Community Board (CB) (optional)', 'Address',
      'Violation No. (optional)', 'Property type', 'Notes (optional)'])
    expect(field('Community Board (CB) (optional)')).toHaveAttribute('maxLength', '10')
    expect(screen.queryByText(/BBL/)).not.toBeInTheDocument()
    expect(borough()).toHaveFocus()
  })

  it('caps each text field at what the backend takes, the block and lot as numbers', () => {
    renderModal({ kind: 'sidewalk' })
    expect(block()).toHaveAttribute('maxLength', '5')
    expect(block()).toHaveAttribute('inputMode', 'numeric')
    expect(lot()).toHaveAttribute('maxLength', '4')
    expect(lot()).toHaveAttribute('inputMode', 'numeric')
    expect(address()).toHaveAttribute('maxLength', String(MAX_ADDRESS_LENGTH))
    expect(violation()).toHaveAttribute('maxLength', String(MAX_VIOLATION_LENGTH))
    expect(notes()).toHaveAttribute('maxLength', String(MAX_NOTES_LENGTH))
    expect(notes().tagName).toBe('TEXTAREA')
  })

  it('hints how to type the block and the lot', () => {
    renderModal({ kind: 'sidewalk' })
    expect(screen.getByText(BLOCK_HINT)).toBeInTheDocument()
    expect(screen.getByText(LOT_HINT)).toBeInTheDocument()
  })

  it('offers the five boroughs, with no default, and the three property types by their labels', () => {
    renderModal({ kind: 'sidewalk' })
    expect(borough()).toHaveValue('')
    expect(enabledOptions(borough()).map(option => option.value))
      .toEqual(['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island'])
    expect(enabledOptions(type()).map(option => [option.value, option.textContent])).toEqual([
      ['1_3_family', '1-3 family'],
      ['4_plus_family', '4+ family / commercial'],
      ['expedited', 'Expedited'],
    ])
  })

  it('drops leading zeros from the block and lot when they lose focus, keeping a zero as 0', async () => {
    renderModal({ kind: 'sidewalk' })
    await userEvent.type(block(), '00123')
    await userEvent.type(lot(), '0000')
    expect(block()).toHaveDisplayValue('123')
    await userEvent.tab()
    expect(lot()).toHaveDisplayValue('0')
  })

  it.each([
    ['block', 'Block', { blockText: '12a' }, BLOCK_INVALID],
    ['lot', 'Lot', { lotText: '4-5' }, LOT_INVALID],
  ])('says a %s that is not digits under it and keeps Save off', async (key, label, typed, message) => {
    renderModal({ kind: 'sidewalk' })
    await fillSidewalk(typed)
    expect(screen.getByText(message)).toHaveAttribute('id', `property-${key}-hint`)
    expect(field(label)).toHaveAttribute('aria-invalid', 'true')
    expect(saveButton()).toBeDisabled()
  })

  it.each([
    ['borough', { boro: null }],
    ['block', { blockText: '' }],
    ['lot', { lotText: '' }],
    ['address', { addressText: '' }],
    ['property type', { typeValue: '' }],
  ])('keeps Save off without a %s', async (_, missing) => {
    renderModal({ kind: 'sidewalk' })
    await fillSidewalk(missing)
    expect(saveButton()).toBeDisabled()
  })

  it('passes on the kind and every field, trimmed, the block and lot without leading zeros and a blank violation as null', async () => {
    const { onSave } = renderModal({ kind: 'sidewalk' })
    await fillSidewalk({ boro: 'Brooklyn', blockText: '00120', lotText: '0045', addressText: ' 12 Main St ' })
    await userEvent.type(violation(), '   ')
    await userEvent.type(notes(), '   ')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({
      kind: 'sidewalk', boro: 'Brooklyn', block: '120', lot: '45', community_board: null, address: '12 Main St',
      violation_no: null, property_type: '4_plus_family', notes: null,
    })
  })

  it('passes on a community board, trimmed', async () => {
    const { onSave } = renderModal({ kind: 'sidewalk' })
    await fillSidewalk()
    await userEvent.type(field('Community Board (CB) (optional)'), ' QN13 ')
    await userEvent.click(saveButton())
    expect(onSave.mock.calls[0][0].community_board).toBe('QN13')
  })
})

describe('PropertyFormModal — adding a ped ramp', () => {
  it('opens titled "Add ped ramp" with the ramp fields only', () => {
    renderModal({ kind: 'ped_ramp' })
    expect(screen.getByRole('dialog', { name: 'Add ped ramp' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Block')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Lot')).not.toBeInTheDocument()
    expect(field('Intersection 1st Street')).toHaveAttribute('maxLength', String(MAX_STREET_LENGTH))
    expect(enabledOptions(field('Quadrant')).map(option => option.value)).toEqual(['NE', 'NW', 'SE', 'SW'])
    expect(enabledOptions(field('Type')).map(option => [option.value, option.textContent])).toEqual([
      ['PERPENDICULAR', 'Perpendicular'], ['PARALLEL', 'Parallel'], ['CUT_THROUGH', 'Cut-through'],
    ])
    expect(saveButton()).toBeDisabled()
  })

  it('offers Facing by the two street names only once both are filled', async () => {
    renderModal({ kind: 'ped_ramp' })
    expect(field('Facing')).toBeDisabled()
    expect(within(field('Facing')).getByRole('option')).toHaveTextContent(FACING_HINT)
    await userEvent.type(field('Intersection 1st Street'), 'Main St')
    expect(field('Facing')).toBeDisabled()
    await userEvent.type(field('Intersection 2nd Street'), '37th Ave')
    expect(field('Facing')).toBeEnabled()
    expect(enabledOptions(field('Facing')).map(option => [option.value, option.textContent]))
      .toEqual([['street_1', 'Main St'], ['street_2', '37th Ave']])
  })

  it('passes on the kind and every ramp field, trimmed', async () => {
    const { onSave } = renderModal({ kind: 'ped_ramp' })
    await fillRamp({ street1: ' Main St ' })
    await userEvent.type(notes(), ' Curb cut cracked ')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({
      kind: 'ped_ramp', boro: 'Queens', community_board: null, intersection_street_1: 'Main St',
      intersection_street_2: '37th Ave', quadrant: 'SE', facing_street: 'street_2', ramp_type: 'CUT_THROUGH', corner_id: null,
      notes: 'Curb cut cracked',
    })
  })

  it('keeps Save off until it faces a street', async () => {
    renderModal({ kind: 'ped_ramp' })
    await fillRamp({ facing: null })
    expect(saveButton()).toBeDisabled()
  })
})

describe('PropertyFormModal — editing', () => {
  it('opens a sidewalk pre-filled, its kind a fixed line, with Save off until something changes', async () => {
    renderModal({ mode: 'edit', initial: SIDEWALK })
    expect(screen.getByRole('dialog', { name: 'Edit sidewalk' })).toBeInTheDocument()
    expect(screen.getByText('Site type: Sidewalk')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /kind/i })).not.toBeInTheDocument()
    expect(borough()).toHaveValue('Queens')
    expect(block()).toHaveDisplayValue('123')
    expect(lot()).toHaveDisplayValue('45')
    expect(violation()).toHaveDisplayValue('V-1')
    expect(type()).toHaveValue('1_3_family')
    expect(notes()).toHaveDisplayValue('Corner lot')
    expect(saveButton()).toBeDisabled()
    await userEvent.type(address(), ' ')
    expect(saveButton()).toBeDisabled() // trimmed, it is the same
  })

  it('leaves the borough free to change, and passes on only what changed', async () => {
    const { onSave } = renderModal({ mode: 'edit', initial: SIDEWALK })
    expect(borough()).toBeEnabled()
    await userEvent.selectOptions(borough(), 'Manhattan')
    await userEvent.clear(lot())
    await userEvent.type(lot(), '0001')
    await userEvent.clear(violation())
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ boro: 'Manhattan', lot: '1', violation_no: null })
  })

  it('counts a block typed with leading zeros as unchanged', async () => {
    renderModal({ mode: 'edit', initial: SIDEWALK })
    await userEvent.clear(block())
    await userEvent.type(block(), '00123')
    expect(saveButton()).toBeDisabled()
  })

  it('opens a ped ramp pre-filled, its kind fixed, and passes on only what changed', async () => {
    const { onSave } = renderModal({ mode: 'edit', initial: RAMP })
    expect(screen.getByRole('dialog', { name: 'Edit ped ramp' })).toBeInTheDocument()
    expect(screen.getByText('Site type: Pedestrian Ramp')).toBeInTheDocument()
    expect(screen.queryByLabelText('Block')).not.toBeInTheDocument()
    expect(field('Facing')).toHaveValue('street_2')
    await userEvent.selectOptions(field('Quadrant'), 'NW')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ quadrant: 'NW' })
  })

  it('sends cleared notes as null, and nothing else', async () => {
    const { onSave } = renderModal({ mode: 'edit', initial: SIDEWALK })
    await userEvent.clear(notes())
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ notes: null })
  })

  it('keeps Save off when a required field is emptied', async () => {
    renderModal({ mode: 'edit', initial: RAMP })
    await userEvent.clear(field('Intersection 2nd Street'))
    expect(saveButton()).toBeDisabled()
    expect(field('Facing')).toBeDisabled()
  })
})

describe('PropertyFormModal — refusals', () => {
  const failure = (status, message, body = {}) => Object.assign(new Error(message), { status, body })
  const TAKEN = failure(409, 'A site at Queens Block 123 Lot 45 already exists in this project.', { existing_property_id: 'x' })

  it('shows a taken borough, block and lot above the three together, not on the block alone', () => {
    renderModal({ mode: 'edit', initial: SIDEWALK, error: TAKEN })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(BLOCK_LOT_TAKEN)
    expect(alert).toHaveAttribute('id', 'property-location-error')
    expect(alert.compareDocumentPosition(borough()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    for (const input of [borough(), block(), lot()]) {
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input.getAttribute('aria-describedby')).toContain('property-location-error')
    }
    expect(address()).toHaveAttribute('aria-invalid', 'false')
  })

  it("puts a 422's messages under the fields they name", () => {
    renderModal({ kind: 'ped_ramp', error: failure(422, 'x', { detail: [
      { loc: ['body', 'quadrant'], msg: "Input should be 'NE', 'NW', 'SE' or 'SW'" },
      { loc: ['body', 'intersection_street_1'], msg: 'Field required' },
    ] }) })
    expect(field('Quadrant')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Field required')).toHaveAttribute('id', 'property-intersection_street_1-error')
    expect(screen.getByText(/Input should be/)).toHaveAttribute('id', 'property-quadrant-error')
  })

  it("puts a 422 on a sidewalk's block under the block", () => {
    renderModal({ kind: 'sidewalk', error: failure(422, 'x', { detail: [
      { loc: ['body', 'block'], msg: 'Value error, block can have at most 5 digits' },
    ] }) })
    expect(screen.getByText(/at most 5 digits/)).toHaveAttribute('id', 'property-block-error')
    expect(block()).toHaveAttribute('aria-invalid', 'true')
  })

  it('says a refused kind change as the backend worded it, below the form', () => {
    renderModal({ mode: 'edit', initial: SIDEWALK, error: failure(400, 'Property kind cannot be changed. Delete and recreate.') })
    expect(screen.getByRole('alert')).toHaveTextContent('Property kind cannot be changed. Delete and recreate.')
    expect(block()).toHaveAttribute('aria-invalid', 'false')
  })

  it('locks the form while saving', () => {
    renderModal({ kind: 'sidewalk', busy: true })
    expect(borough()).toBeDisabled()
    expect(block()).toBeDisabled()
    expect(lot()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
  })

  it('cancels', async () => {
    const { onCancel } = renderModal({ kind: 'sidewalk' })
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
