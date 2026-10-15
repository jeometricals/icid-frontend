import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PropertyFormModal, {
  BBL_HINT, BBL_TAKEN, FACING_HINT, MAX_ADDRESS_LENGTH, MAX_NOTES_LENGTH, MAX_STREET_LENGTH, MAX_VIOLATION_LENGTH,
} from '../PropertyFormModal'

const SIDEWALK = { id: 'c0000000-0000-4000-8000-000000000001', project_id: 'HWS0023', kind: 'sidewalk', boro: 'Queens',
  bbl: '4001230045', address: '12 Main St', property_type: '1_3_family', violation_no: 'V-1', notes: 'Corner lot',
  created_at: '2026-09-14T12:00:00Z' }
const RAMP = { id: 'c0000000-0000-4000-8000-000000000002', project_id: 'HWS0023', kind: 'ped_ramp', boro: 'Brooklyn',
  bbl: null, address: null, property_type: null, violation_no: null, intersection_street_1: 'Atlantic Ave',
  intersection_street_2: 'Court St', quadrant: 'NE', facing_street: 'street_2', ramp_type: 'PERPENDICULAR' }

function renderModal(props = {}) {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  const view = render(<PropertyFormModal onSave={onSave} onCancel={onCancel} {...props} />)
  return { onSave, onCancel, ...view }
}

const field = (label) => screen.getByLabelText(label)
const borough = () => field('Borough')
const bbl = () => field('BBL')
const address = () => field('Address')
const violation = () => field(/Violation No\./)
const type = () => field('Property type')
const notes = () => field(/Notes/)
const saveButton = () => screen.getByRole('button', { name: 'Save' })
const enabledOptions = (select) => within(select).getAllByRole('option').filter(option => !option.disabled)

async function fillSidewalk({ bblText = '4001230045', addressText = '12 Main St', typeValue = '4_plus_family' } = {}) {
  if (bblText) await userEvent.type(bbl(), bblText)
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
    expect(bbl()).toHaveDisplayValue('')
    expect(address()).toHaveDisplayValue('')
    expect(type()).toHaveValue('')
    expect(notes()).toHaveDisplayValue('')
    expect(saveButton()).toBeDisabled()
  })

  it('caps each text field at what the backend takes', () => {
    renderModal({ kind: 'sidewalk' })
    expect(bbl()).toHaveAttribute('maxLength', '10')
    expect(address()).toHaveAttribute('maxLength', String(MAX_ADDRESS_LENGTH))
    expect(violation()).toHaveAttribute('maxLength', String(MAX_VIOLATION_LENGTH))
    expect(notes()).toHaveAttribute('maxLength', String(MAX_NOTES_LENGTH))
    expect(notes().tagName).toBe('TEXTAREA')
  })

  it('offers the five boroughs and the three property types by their labels', () => {
    renderModal({ kind: 'sidewalk' })
    expect(enabledOptions(borough()).map(option => option.value))
      .toEqual(['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island'])
    expect(enabledOptions(type()).map(option => [option.value, option.textContent])).toEqual([
      ['1_3_family', '1-3 family'],
      ['4_plus_family', '4+ family / commercial'],
      ['expedited', 'Expedited'],
    ])
  })

  it('previews the block and lot as the BBL is typed, and takes the borough from it', async () => {
    renderModal({ kind: 'sidewalk' })
    expect(screen.getByText('Block — · Lot —')).toBeInTheDocument()
    await userEvent.type(bbl(), '30012')
    expect(screen.getByText(BBL_HINT)).toBeInTheDocument()
    expect(bbl()).toHaveAttribute('aria-invalid', 'true')
    await userEvent.type(bbl(), '00045')
    expect(screen.getByText('Block 120 · Lot 45')).toBeInTheDocument()
    expect(borough()).toHaveValue('Brooklyn')
    expect(borough()).toBeDisabled()
  })

  it('refuses a BBL that does not start with a borough digit', async () => {
    renderModal({ kind: 'sidewalk' })
    await fillSidewalk({ bblText: '9001230045' })
    expect(screen.getByText(BBL_HINT)).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  it.each([
    ['BBL', { bblText: '' }],
    ['address', { addressText: '' }],
    ['property type', { typeValue: '' }],
  ])('keeps Save off without a %s', async (_, missing) => {
    renderModal({ kind: 'sidewalk' })
    await fillSidewalk(missing)
    expect(saveButton()).toBeDisabled()
  })

  it('passes on the kind and every field, trimmed, the borough the BBL\'s and a blank violation as null', async () => {
    const { onSave } = renderModal({ kind: 'sidewalk' })
    await fillSidewalk({ addressText: ' 12 Main St ' })
    await userEvent.type(violation(), '   ')
    await userEvent.type(notes(), '   ')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({
      kind: 'sidewalk', boro: 'Queens', bbl: '4001230045', address: '12 Main St', violation_no: null, property_type: '4_plus_family',
      notes: null,
    })
  })
})

describe('PropertyFormModal — adding a ped ramp', () => {
  it('opens titled "Add ped ramp" with the ramp fields only', () => {
    renderModal({ kind: 'ped_ramp' })
    expect(screen.getByRole('dialog', { name: 'Add ped ramp' })).toBeInTheDocument()
    expect(screen.queryByLabelText('BBL')).not.toBeInTheDocument()
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
      kind: 'ped_ramp', boro: 'Queens', intersection_street_1: 'Main St', intersection_street_2: '37th Ave',
      quadrant: 'SE', facing_street: 'street_2', ramp_type: 'CUT_THROUGH', notes: 'Curb cut cracked',
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
    expect(bbl()).toHaveDisplayValue('4001230045')
    expect(screen.getByText('Block 123 · Lot 45')).toBeInTheDocument()
    expect(violation()).toHaveDisplayValue('V-1')
    expect(type()).toHaveValue('1_3_family')
    expect(notes()).toHaveDisplayValue('Corner lot')
    expect(saveButton()).toBeDisabled()
    await userEvent.type(address(), ' ')
    expect(saveButton()).toBeDisabled() // trimmed, it is the same
  })

  it('passes on only what changed; a new BBL brings its borough', async () => {
    const { onSave } = renderModal({ mode: 'edit', initial: SIDEWALK })
    await userEvent.clear(bbl())
    await userEvent.type(bbl(), '1000010001')
    await userEvent.clear(violation())
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ boro: 'Manhattan', bbl: '1000010001', violation_no: null })
  })

  it('opens a ped ramp pre-filled, its kind fixed, and passes on only what changed', async () => {
    const { onSave } = renderModal({ mode: 'edit', initial: RAMP })
    expect(screen.getByRole('dialog', { name: 'Edit ped ramp' })).toBeInTheDocument()
    expect(screen.getByText('Site type: Pedestrian Ramp')).toBeInTheDocument()
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

  it('shows a taken BBL above the BBL field', () => {
    renderModal({ kind: 'sidewalk', error: failure(409, 'A property with this BBL already exists in this project', { existing_property_id: 'x' }) })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(BBL_TAKEN)
    expect(alert.compareDocumentPosition(bbl()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(bbl()).toHaveAttribute('aria-invalid', 'true')
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

  it('says a refused kind change as the backend worded it, below the form', () => {
    renderModal({ mode: 'edit', initial: SIDEWALK, error: failure(400, 'Property kind cannot be changed. Delete and recreate.') })
    expect(screen.getByRole('alert')).toHaveTextContent('Property kind cannot be changed. Delete and recreate.')
    expect(bbl()).toHaveAttribute('aria-invalid', 'false')
  })

  it('locks the form while saving', () => {
    renderModal({ kind: 'sidewalk', busy: true })
    expect(bbl()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
  })

  it('cancels', async () => {
    const { onCancel } = renderModal({ kind: 'sidewalk' })
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
