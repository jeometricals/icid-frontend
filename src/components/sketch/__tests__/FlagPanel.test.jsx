import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FlagPanel, { parseDimensions } from '../FlagPanel'
import * as api from '../../../services/api'
import { MOCK_CONTRACT_ITEMS } from '../../../test/contractItems'

vi.mock('../../../services/api', () => ({ updateFlag: vi.fn() }))

const FLAG = {
  id: 'flag-1', pir_page_id: 'page-1', display_order: 3, shape: 'rectangle', dimensions: { L: 5, W: 5 },
  sketch_x: 100, sketch_y: 100, rotation: 0, surveyed_mark: 'number_only', surveyed_is_assessable: true,
  surveyed_non_assessable_reason: null, surveyed_thickness: '4in', added_in_field: false, pay_item_id: null,
  computed_quantity: 25, reported_quantity: null, quantity: 25, quantity_delta_reason: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  api.updateFlag.mockImplementation(async (id, body) => ({ ...FLAG, ...body, computed_quantity: body.dimensions ? body.dimensions.L * body.dimensions.W : 25 }))
})

function renderPanel(props = {}) {
  const onSaved = vi.fn()
  const onDelete = vi.fn()
  const view = render(
    <FlagPanel flag={FLAG} contractItems={MOCK_CONTRACT_ITEMS} writer onSaved={onSaved} onDelete={onDelete} {...props} />,
  )
  return { onSaved, onDelete, ...view }
}

const sent = () => api.updateFlag.mock.calls.map(([, body]) => body)

describe('FlagPanel — editing', () => {
  it('saves a dimension edit after a pause, in one PATCH, and hands over the answer (with the backend\'s area)', async () => {
    const { onSaved } = renderPanel()
    expect(screen.getByText('25.00 SF')).toBeInTheDocument()
    const length = screen.getByLabelText('Length (ft)')
    await userEvent.clear(length)
    await userEvent.type(length, '8')
    expect(api.updateFlag).not.toHaveBeenCalled()
    await waitFor(() => expect(api.updateFlag).toHaveBeenCalledTimes(1))
    expect(api.updateFlag).toHaveBeenCalledWith('flag-1', { shape: 'rectangle', dimensions: { L: 8, W: 5 } })
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ computed_quantity: 40 })))
  })

  it("doesn't send dimensions out of range, and says so", async () => {
    renderPanel()
    await userEvent.clear(screen.getByLabelText('Width (ft)'))
    expect(screen.getByText('Every length above 0.')).toBeInTheDocument()
    await new Promise(resolve => setTimeout(resolve, 400))
    expect(api.updateFlag).not.toHaveBeenCalled()
  })

  it('starts a new shape from its default dimensions, sent with it', async () => {
    renderPanel()
    await userEvent.selectOptions(screen.getByLabelText('Shape'), 'triangle')
    expect(screen.getByLabelText('Leg a (ft)')).toHaveValue(5)
    await waitFor(() => expect(sent()).toEqual([{ shape: 'triangle', dimensions: { a: 5, b: 5 } }]))
  })

  it('takes an arc\'s angle in degrees and sends radians', async () => {
    renderPanel({ flag: { ...FLAG, shape: 'arc', dimensions: { r: 5, theta: Math.PI } } })
    expect(screen.getByLabelText('Angle (°)')).toHaveValue(180)
    await userEvent.clear(screen.getByLabelText('Angle (°)'))
    await userEvent.type(screen.getByLabelText('Angle (°)'), '90')
    await waitFor(() => expect(sent().at(-1).dimensions.theta).toBeCloseTo(Math.PI / 2))
  })

  it('edits a polygon\'s vertices, never fewer than three', async () => {
    renderPanel({ flag: { ...FLAG, shape: 'polygon', dimensions: { vertices: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }] } } })
    expect(screen.getByRole('button', { name: 'Remove vertex 1' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Add vertex' }))
    await userEvent.type(screen.getByLabelText('Vertex 4 x (ft)'), '-1')
    await userEvent.type(screen.getByLabelText('Vertex 4 y (ft)'), '2')
    await waitFor(() => expect(sent().at(-1).dimensions.vertices).toHaveLength(4))
  })

  it('saves the rotation, the mark, the thickness and the display order', async () => {
    renderPanel()
    await userEvent.clear(screen.getByLabelText('Rotation (°)'))
    await userEvent.type(screen.getByLabelText('Rotation (°)'), '45')
    await userEvent.click(screen.getByRole('radio', { name: 'Tick' }))
    await userEvent.click(screen.getByRole('radio', { name: '7"' }))
    await userEvent.clear(screen.getByLabelText('Display order'))
    await userEvent.type(screen.getByLabelText('Display order'), '9')
    await waitFor(() => expect(api.updateFlag).toHaveBeenCalled())
    expect(Object.assign({}, ...sent())).toEqual({ rotation: 45, surveyed_mark: 'tick', surveyed_thickness: '7in', display_order: 9 })
  })

  it('takes the mark away for a flag added in the field, and gives "Number only" back when unticked', async () => {
    renderPanel()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Added in field' }))
    expect(screen.getByRole('radio', { name: 'Tick' })).toBeDisabled()
    await waitFor(() => expect(sent().at(-1)).toEqual({ added_in_field: true, surveyed_mark: 'none' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Added in field' }))
    await waitFor(() => expect(sent().at(-1)).toEqual({ added_in_field: false, surveyed_mark: 'number_only' }))
  })

  it('waits for a reason before saving a flag as non-assessable', async () => {
    renderPanel()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Assessable' }))
    expect(screen.getByText('Pick a reason to save it as non-assessable.')).toBeInTheDocument()
    await new Promise(resolve => setTimeout(resolve, 400))
    expect(api.updateFlag).not.toHaveBeenCalled()
    await userEvent.selectOptions(screen.getByLabelText('Non-assessable reason'), 'hydrant')
    await waitFor(() => expect(sent()).toEqual([{ surveyed_is_assessable: false, surveyed_non_assessable_reason: 'hydrant' }]))
  })

  it('picks a pay item from the contract items', async () => {
    renderPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Choose' }))
    const list = screen.getByRole('listbox', { name: 'Pay items' })
    await userEvent.click(within(list).getAllByRole('button')[1])
    await waitFor(() => expect(sent()).toEqual([{ pay_item_id: MOCK_CONTRACT_ITEMS[1].contract_item_id }]))
  })

  it('overrides the reported quantity, and clears the override', async () => {
    renderPanel({ flag: { ...FLAG, reported_quantity: 30, quantity_delta_reason: 'Field measure' } })
    expect(screen.getByLabelText('Reported quantity (SF)')).toHaveValue(30)
    await userEvent.clear(screen.getByLabelText('Reported quantity (SF)'))
    await userEvent.type(screen.getByLabelText('Reported quantity (SF)'), '32.5')
    await waitFor(() => expect(sent().at(-1)).toEqual({ reported_quantity: 32.5 }))
    await userEvent.click(screen.getByRole('button', { name: 'Clear override' }))
    expect(screen.getByLabelText('Reported quantity (SF)')).toHaveValue(null)
    expect(screen.getByLabelText('Quantity delta reason')).toHaveValue('')
    await waitFor(() => expect(sent().at(-1)).toEqual({ reported_quantity: null }))
  })

  it('saves the quantity delta reason, a blank one as null', async () => {
    renderPanel()
    await userEvent.type(screen.getByLabelText('Quantity delta reason'), 'Field measure')
    await waitFor(() => expect(sent().at(-1)).toEqual({ quantity_delta_reason: 'Field measure' }))
  })

  it('shows a refusal at the top', async () => {
    api.updateFlag.mockRejectedValue(Object.assign(new Error('Pay item belongs to a different project'), { status: 400 }))
    renderPanel()
    await userEvent.click(screen.getByRole('radio', { name: 'Tick' }))
    expect(await screen.findByText("Couldn't save the flag: Pay item belongs to a different project")).toBeInTheDocument()
  })

  it('sends what is still waiting when it closes (another flag is selected)', async () => {
    const { unmount } = renderPanel()
    await userEvent.click(screen.getByRole('radio', { name: 'Tick' }))
    unmount()
    expect(api.updateFlag).toHaveBeenCalledWith('flag-1', { surveyed_mark: 'tick' })
  })

  it('hands Delete flag to the page', async () => {
    const { onDelete } = renderPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Delete flag' }))
    expect(onDelete).toHaveBeenCalledWith(FLAG)
  })
})

describe('FlagPanel — reading', () => {
  it('shows a reader everything disabled, with no Delete', () => {
    renderPanel({ writer: false })
    expect(screen.getByLabelText('Length (ft)')).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Tick' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Choose' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Delete flag' })).not.toBeInTheDocument()
  })
})

describe('parseDimensions', () => {
  it('takes every shape\'s typed dimensions, or null', () => {
    expect(parseDimensions('trapezoid', { a: '4', b: '6', w: '5' })).toEqual({ a: 4, b: 6, w: 5 })
    expect(parseDimensions('rectangle', { L: '4', W: '' })).toBeNull()
    expect(parseDimensions('arc', { r: '5', theta: '400' })).toBeNull()
    expect(parseDimensions('polygon', { vertices: [{ x: '0', y: '0' }, { x: '1', y: '1' }, { x: '2', y: '2' }] })).toBeNull()
  })
})

describe('FlagPanel — a flag an approved IDR claimed', () => {
  it('says which IDR claimed it and when it was constructed, the IDR a button that opens it', async () => {
    const onOpenIdr = vi.fn()
    const claimed = { ...FLAG, claimed_by_idr_id: 'idr-9', claimed_by_idr_number: '042', constructed_on: '2026-10-03', is_constructed: true }
    renderPanel({ flag: claimed, onOpenIdr })
    expect(screen.getByText(/Claimed by/)).toHaveTextContent('Claimed by IDR 042 · constructed Oct 3')
    await userEvent.click(screen.getByRole('button', { name: 'IDR 042' }))
    expect(onOpenIdr).toHaveBeenCalledWith(claimed)
  })

  it('says nothing of a claim on an unclaimed flag', () => {
    renderPanel()
    expect(screen.queryByText(/Claimed by/)).not.toBeInTheDocument()
  })
})
