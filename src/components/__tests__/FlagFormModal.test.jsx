import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FlagFormModal, { MARK_RULE, storedDimensions } from '../FlagFormModal'
import { MOCK_CONTRACT_ITEMS } from '../../test/contractItems'

const FLAG = {
  id: 'f1000000-0000-4000-8000-000000000001', pir_id: 'p1', display_order: 3, shape: 'rectangle',
  dimensions: { L: 8.5, W: 5 }, surveyed_mark: 'cross', surveyed_is_assessable: true,
  surveyed_non_assessable_reason: null, surveyed_thickness: '4in', added_in_field: false,
  pay_item_id: MOCK_CONTRACT_ITEMS[1].contract_item_id, computed_quantity: 42.5, reported_quantity: null,
  quantity_delta_reason: null,
}

function renderModal(props = {}) {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  render(<FlagFormModal contractItems={MOCK_CONTRACT_ITEMS} onSave={onSave} onCancel={onCancel} {...props} />)
  return { onSave, onCancel }
}

const saveButton = () => screen.getByRole('button', { name: 'Save' })
const area = () => screen.getByText(/Computed area:/)
const failure = (status, message, body = {}) => Object.assign(new Error(message), { status, body })

// Fills a rectangle flag that is ready to save, unless told otherwise
async function fillRectangle({ L = '8.5', W = '5', mark = 'cross', thickness = '4in' } = {}) {
  await userEvent.selectOptions(screen.getByLabelText('Shape'), 'rectangle')
  if (L) await userEvent.type(screen.getByLabelText('Length (ft)'), L)
  if (W) await userEvent.type(screen.getByLabelText('Width (ft)'), W)
  if (mark) await userEvent.selectOptions(screen.getByLabelText('Surveyed mark'), mark)
  if (thickness) await userEvent.selectOptions(screen.getByLabelText('Thickness'), thickness)
}

describe('FlagFormModal — shapes and the area preview', () => {
  it('opens "Add flag" at the next display order, with no shape and Save off', () => {
    renderModal({ nextDisplayOrder: 4 })
    expect(screen.getByRole('dialog', { name: 'Add flag' })).toBeInTheDocument()
    expect(screen.getByLabelText('Display order')).toHaveValue(4)
    expect(screen.queryByText(/Computed area/)).not.toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  it.each([
    ['rectangle', ['Length (ft)', 'Width (ft)'], ['8.5', '5'], '42.50 SF'],
    ['trapezoid', ['Edge a (ft)', 'Edge b (ft)', 'Perpendicular width w (ft)'], ['4', '6', '3'], '15.00 SF'],
    ['triangle', ['Leg a (ft)', 'Leg b (ft)'], ['3', '4'], '6.00 SF'],
    ['arc', ['Radius r (ft)', 'Central angle θ (degrees)'], ['2', '180'], '6.28 SF'],
  ])('gives a %s its own dimension fields, and previews its area as they are typed', async (shape, labels, typed, expected) => {
    renderModal()
    await userEvent.selectOptions(screen.getByLabelText('Shape'), shape)
    expect(area()).toHaveTextContent('Computed area: —')
    for (const [index, label] of labels.entries()) {
      await userEvent.type(screen.getByLabelText(label), typed[index])
    }
    expect(area()).toHaveTextContent(`Computed area: ${expected}`)
  })

  it('gives a polygon three vertex rows to start, adds and removes rows, and never fewer than three', async () => {
    renderModal()
    await userEvent.selectOptions(screen.getByLabelText('Shape'), 'polygon')
    const remove = () => screen.getAllByRole('button', { name: /Remove vertex/ })
    expect(remove()).toHaveLength(3)
    expect(remove()[0]).toBeDisabled()

    const corners = [[0, 0], [4, 0], [4, 3], [0, 3]]
    await userEvent.click(screen.getByRole('button', { name: 'Add vertex' }))
    for (const [index, [x, y]] of corners.entries()) {
      await userEvent.type(screen.getByLabelText('x (ft)', { selector: `#flag-vertex-${index}-x` }), String(x))
      await userEvent.type(screen.getByLabelText('y (ft)', { selector: `#flag-vertex-${index}-y` }), String(y))
    }
    expect(area()).toHaveTextContent('Computed area: 12.00 SF')

    await userEvent.click(screen.getByRole('button', { name: 'Remove vertex 4' }))
    expect(remove()).toHaveLength(3)
    expect(area()).toHaveTextContent('Computed area: 6.00 SF')
  })

  it('keeps what was typed for a shape when switching away and back', async () => {
    renderModal()
    await userEvent.selectOptions(screen.getByLabelText('Shape'), 'rectangle')
    await userEvent.type(screen.getByLabelText('Length (ft)'), '7')
    await userEvent.selectOptions(screen.getByLabelText('Shape'), 'triangle')
    await userEvent.selectOptions(screen.getByLabelText('Shape'), 'rectangle')
    expect(screen.getByLabelText('Length (ft)')).toHaveValue(7)
  })

  it('stores an arc\'s angle in radians, and refuses one past 360°', () => {
    expect(storedDimensions('arc', { r: '2', thetaDegrees: '90' })).toEqual({ r: 2, theta: Math.PI / 2 })
    expect(storedDimensions('arc', { r: '2', thetaDegrees: '361' })).toBeNull()
    expect(storedDimensions('rectangle', { L: '0', W: '5' })).toBeNull()
    expect(storedDimensions('polygon', { vertices: [{ x: '0', y: '0' }, { x: '1', y: '1' }, { x: '2', y: '2' }] })).toBeNull()
  })
})

describe('FlagFormModal — the survey\'s rules', () => {
  it('asks why when the flag isn\'t assessable, and needs an answer', async () => {
    renderModal()
    await fillRectangle()
    expect(screen.queryByLabelText('Non-assessable reason')).not.toBeInTheDocument()
    expect(saveButton()).toBeEnabled()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Assessable' }))
    expect(screen.getByLabelText('Non-assessable reason')).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
    await userEvent.selectOptions(screen.getByLabelText('Non-assessable reason'), 'hydrant')
    expect(saveButton()).toBeEnabled()
  })

  it('needs "Added in field" exactly when the mark is None', async () => {
    renderModal()
    await fillRectangle({ mark: 'none' })
    expect(screen.getByText(MARK_RULE)).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Added in field' }))
    expect(screen.queryByText(MARK_RULE)).not.toBeInTheDocument()
    expect(saveButton()).toBeEnabled()

    await userEvent.selectOptions(screen.getByLabelText('Surveyed mark'), 'tick')
    expect(screen.getByText(MARK_RULE)).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  it.each([
    ['a shape\'s dimension', { W: '' }],
    ['a mark', { mark: '' }],
    ['a thickness', { thickness: '' }],
  ])('keeps Save off without %s', async (_, missing) => {
    renderModal()
    await fillRectangle(missing)
    expect(saveButton()).toBeDisabled()
  })

  it('asks for a reason for the difference only when the reported quantity differs from the computed one', async () => {
    renderModal()
    await fillRectangle()
    expect(screen.getByLabelText(/Reported quantity/)).toHaveAttribute('placeholder', 'Same as computed')
    await userEvent.type(screen.getByLabelText(/Reported quantity/), '42.5')
    expect(screen.queryByLabelText(/Quantity delta reason/)).not.toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText(/Reported quantity/))
    await userEvent.type(screen.getByLabelText(/Reported quantity/), '45')
    expect(screen.getByLabelText(/Quantity delta reason/)).toBeInTheDocument()
  })

  it('sends the whole flag when adding, the pay item picked from the catalog', async () => {
    const { onSave } = renderModal({ nextDisplayOrder: 2 })
    await fillRectangle()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Assessable' }))
    await userEvent.selectOptions(screen.getByLabelText('Non-assessable reason'), 'city_tree')
    await userEvent.click(screen.getByRole('button', { name: 'Choose' }))
    const payItems = screen.getByRole('listbox', { name: 'Pay items' })
    await userEvent.click(within(within(payItems).getAllByRole('option')[0]).getByRole('button'))
    await userEvent.type(screen.getByLabelText(/Reported quantity/), '45')
    await userEvent.type(screen.getByLabelText(/Quantity delta reason/), 'Measured on site')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({
      display_order: 2, shape: 'rectangle', dimensions: { L: 8.5, W: 5 }, surveyed_mark: 'cross',
      surveyed_is_assessable: false, surveyed_non_assessable_reason: 'city_tree', surveyed_thickness: '4in',
      added_in_field: false, pay_item_id: MOCK_CONTRACT_ITEMS[0].contract_item_id, reported_quantity: 45,
      quantity_delta_reason: 'Measured on site',
    })
  })
})

describe('FlagFormModal — editing', () => {
  it('opens "Edit flag" pre-filled, with Save off until something changes', () => {
    renderModal({ mode: 'edit', initial: FLAG })
    expect(screen.getByRole('dialog', { name: 'Edit flag' })).toBeInTheDocument()
    expect(screen.getByLabelText('Display order')).toHaveValue(3)
    expect(screen.getByLabelText('Length (ft)')).toHaveValue(8.5)
    expect(screen.getByLabelText('Thickness')).toHaveValue('4in')
    expect(area()).toHaveTextContent('42.50 SF')
    expect(screen.getByText(`${MOCK_CONTRACT_ITEMS[1].item_no} — ${MOCK_CONTRACT_ITEMS[1].description}`)).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  it('sends only what changed, the dimensions whole', async () => {
    const { onSave } = renderModal({ mode: 'edit', initial: FLAG })
    await userEvent.clear(screen.getByLabelText('Width (ft)'))
    await userEvent.type(screen.getByLabelText('Width (ft)'), '6')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ dimensions: { L: 8.5, W: 6 } })
  })

  it('sends a new shape with its dimensions', async () => {
    const { onSave } = renderModal({ mode: 'edit', initial: FLAG })
    await userEvent.selectOptions(screen.getByLabelText('Shape'), 'triangle')
    await userEvent.type(screen.getByLabelText('Leg a (ft)'), '3')
    await userEvent.type(screen.getByLabelText('Leg b (ft)'), '4')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ shape: 'triangle', dimensions: { a: 3, b: 4 } })
  })

  it('sends a cleared pay item and a cleared override as null', async () => {
    const { onSave } = renderModal({ mode: 'edit', initial: { ...FLAG, reported_quantity: 45, quantity_delta_reason: 'x' } })
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    await userEvent.clear(screen.getByLabelText(/Reported quantity/))
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ pay_item_id: null, reported_quantity: null, quantity_delta_reason: null })
  })

  it('shows a stored arc\'s angle in degrees', () => {
    renderModal({ mode: 'edit', initial: { ...FLAG, shape: 'arc', dimensions: { r: 2, theta: Math.PI / 2 } } })
    expect(screen.getByLabelText('Central angle θ (degrees)')).toHaveValue(90)
    expect(saveButton()).toBeDisabled()
  })
})

describe('FlagFormModal — refusals', () => {
  it('puts a 422 on the field it names', () => {
    renderModal({ mode: 'edit', initial: FLAG, error: failure(422, 'x', { detail: [{ loc: ['body', 'display_order'], msg: 'Input should be greater than or equal to 0' }] }) })
    expect(screen.getByRole('alert')).toHaveTextContent('Input should be greater than or equal to 0')
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'flag-display_order-error')
  })

  it('says a rule the whole flag breaks below the form', () => {
    renderModal({ mode: 'edit', initial: FLAG, error: failure(422, 'x', { detail: [{ loc: ['body'], msg: "Value error, a polygon's vertices must enclose an area" }] }) })
    expect(screen.getByRole('alert')).toHaveTextContent("a polygon's vertices must enclose an area")
  })

  it.each([
    [400, 'Pay item belongs to a different project'],
    [409, 'Flag changed meanwhile'],
  ])('says a %s as the backend worded it', (status, message) => {
    renderModal({ mode: 'edit', initial: FLAG, error: failure(status, message) })
    expect(screen.getByRole('alert')).toHaveTextContent(message)
  })
})
