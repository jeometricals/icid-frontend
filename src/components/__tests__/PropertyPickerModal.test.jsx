import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PropertyPickerModal from '../PropertyPickerModal'
import * as api from '../../services/api'

vi.mock('../../services/api', () => ({ listProperties: vi.fn(), bundleProperty: vi.fn() }))

const property = (number, block, lot, address, property_type = '1_3_family') => ({
  id: `c0000000-0000-4000-8000-00000000000${number}`, project_id: 'HWS0023', kind: 'sidewalk', boro: 'Queens', block, lot, address,
  display_address: address, property_type,
  notes: null, created_at: '2026-09-14T12:00:00Z', deleted_at: null,
})
const ELM = property(1, '111', '1', '7 Elm Pl')
const MAIN = property(2, '123', '45', '12 Main St', '4_plus_family')
const MAPLE = property(3, '999', '3', '3 Maple Rd', 'expedited')
const OAK = property(4, '123', '99', '40 Oak Ave')
const TASK_ORDER = { id: 'd0000000-0000-4000-8000-000000000001', project_id: 'HWS0023', task_order_number: 'TO-001',
  properties: [OAK] }

beforeEach(() => {
  vi.clearAllMocks()
  api.listProperties.mockResolvedValue([ELM, MAIN, MAPLE, OAK])
  api.bundleProperty.mockImplementation(async (taskOrderId, propertyId) => ({ ...TASK_ORDER, last: propertyId }))
})

async function renderPicker() {
  const onClose = vi.fn()
  const onDone = vi.fn()
  render(<PropertyPickerModal taskOrder={TASK_ORDER} onClose={onClose} onDone={onDone} />)
  await screen.findByRole('searchbox')
  return { onClose, onDone }
}

const box = (site) => screen.getByRole('checkbox', { name: new RegExp(`^${site}`) })
const shownSites = () => screen.getAllByRole('checkbox').map(input => input.closest('label').querySelector('span').textContent)
const search = () => screen.getByRole('searchbox', { name: 'Search by block, lot or address' })

describe('PropertyPickerModal', () => {
  it('lists the project\'s live properties that aren\'t already in the task order, with block and lot, address and type', async () => {
    await renderPicker()
    expect(api.listProperties).toHaveBeenCalledWith('HWS0023')
    expect(shownSites()).toEqual(['Queens Block 111 Lot 1', 'Queens Block 123 Lot 45', 'Queens Block 999 Lot 3'])
    expect(screen.queryByRole('checkbox', { name: /Queens Block 123 Lot 99/ })).not.toBeInTheDocument()
    expect(box('Queens Block 123 Lot 45').closest('label')).toHaveTextContent('12 Main St')
    expect(box('Queens Block 123 Lot 45').closest('label')).toHaveTextContent('4+ family / commercial')
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })

  it('narrows to one kind with its chips, All to start, together with the search', async () => {
    const ramp = { ...property(5, null, null, '38 St & 31 Ave — SW Quadrant (Facing 31 Ave)'), kind: 'ped_ramp',
      ramp_type: 'CUT_THROUGH', property_type: null }
    api.listProperties.mockResolvedValue([ELM, MAIN, ramp])
    await renderPicker()
    const chip = (name) => screen.getByRole('button', { name })
    expect(chip('All')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    await userEvent.click(chip('Pedramps'))
    expect(chip('Pedramps')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(screen.getByRole('checkbox').closest('label')).toHaveTextContent('Cut-through')
    await userEvent.click(chip('Sidewalks'))
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    await userEvent.type(search(), 'elm')
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    await userEvent.clear(search())
    await userEvent.click(chip('Pedramps'))
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 site' }))
    await waitFor(() => expect(api.bundleProperty).toHaveBeenCalledWith(TASK_ORDER.id, ramp.id))
  })

  it('filters by block, lot or address, any case', async () => {
    await renderPicker()
    await userEvent.type(search(), 'MAIN')
    expect(shownSites()).toEqual(['Queens Block 123 Lot 45'])
    await userEvent.clear(search())
    await userEvent.type(search(), '999')
    expect(shownSites()).toEqual(['Queens Block 999 Lot 3'])
    await userEvent.clear(search())
    await userEvent.type(search(), '45')
    expect(shownSites()).toEqual(['Queens Block 123 Lot 45'])
    await userEvent.clear(search())
    await userEvent.type(search(), 'nowhere')
    expect(screen.getByText('No sites match "nowhere".')).toBeInTheDocument()
  })

  it('shows a site\'s CB beside its block and lot, and finds it by it', async () => {
    api.listProperties.mockResolvedValue([ELM, { ...MAIN, community_board: 'QN13' }, MAPLE, OAK])
    await renderPicker()
    expect(box('Queens Block 123 Lot 45').closest('label')).toHaveTextContent('CB QN13')
    await userEvent.type(search(), 'qn13')
    expect(shownSites()).toEqual(['Queens Block 123 Lot 45'])
  })

  it('lists a ped ramp by its intersection and ramp type, and finds it by a street', async () => {
    const RAMP = { ...property(5, null, null, null, null), kind: 'ped_ramp', ramp_type: 'PARALLEL',
      display_address: 'Atlantic Ave & Court St — NE Quadrant (Facing Court St)' }
    api.listProperties.mockResolvedValue([ELM, RAMP])
    await renderPicker()
    await userEvent.type(search(), 'court')
    const shown = screen.getAllByRole('checkbox')
    expect(shown).toHaveLength(1)
    expect(shown[0].closest('label')).toHaveTextContent('Ped rampAtlantic Ave & Court St — NE Quadrant (Facing Court St)Parallel')
  })

  it('selects several, and "Select all shown" ticks only the rows the search shows', async () => {
    await renderPicker()
    await userEvent.click(box('Queens Block 111 Lot 1'))
    expect(screen.getByRole('button', { name: 'Add 1 site' })).toBeEnabled()
    await userEvent.type(search(), 'Rd')
    await userEvent.click(screen.getByRole('button', { name: 'Select all shown' }))
    expect(screen.getByRole('button', { name: 'Select all shown' })).toBeDisabled()
    await userEvent.clear(search())
    expect(box('Queens Block 111 Lot 1')).toBeChecked()
    expect(box('Queens Block 999 Lot 3')).toBeChecked()
    expect(box('Queens Block 123 Lot 45')).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Add 2 sites' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })

  it('bundles the ticked ones one at a time and reports how many went in', async () => {
    const { onDone } = await renderPicker()
    let inFlight = 0
    let most = 0
    api.bundleProperty.mockImplementation(async (taskOrderId, propertyId) => {
      inFlight += 1
      most = Math.max(most, inFlight)
      await new Promise(resolve => setTimeout(resolve, 5))
      inFlight -= 1
      return { ...TASK_ORDER, last: propertyId }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Select all shown' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add 3 sites' }))

    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(api.bundleProperty.mock.calls).toEqual([[TASK_ORDER.id, ELM.id], [TASK_ORDER.id, MAIN.id], [TASK_ORDER.id, MAPLE.id]])
    expect(most).toBe(1)
    expect(onDone).toHaveBeenCalledWith({ added: 3, failed: null, taskOrder: { ...TASK_ORDER, last: MAPLE.id } })
  })

  it('stops at the first refusal and tries nothing after it', async () => {
    const { onDone } = await renderPicker()
    api.bundleProperty
      .mockResolvedValueOnce({ ...TASK_ORDER, last: ELM.id })
      .mockRejectedValueOnce(new Error('Cannot bundle a deleted property'))
    await userEvent.click(screen.getByRole('button', { name: 'Select all shown' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add 3 sites' }))

    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(api.bundleProperty).toHaveBeenCalledTimes(2)
    expect(onDone).toHaveBeenCalledWith({
      added: 1, failed: { property: MAIN, message: 'Cannot bundle a deleted property' }, taskOrder: { ...TASK_ORDER, last: ELM.id },
    })
  })

  it('says so when every property is already in the task order', async () => {
    api.listProperties.mockResolvedValue([OAK])
    render(<PropertyPickerModal taskOrder={TASK_ORDER} onClose={vi.fn()} onDone={vi.fn()} />)
    expect(await screen.findByText(/already in this task order/)).toBeInTheDocument()
  })

  it('shows a failed read with Retry', async () => {
    api.listProperties.mockRejectedValueOnce(new Error('Failed to fetch properties'))
    render(<PropertyPickerModal taskOrder={TASK_ORDER} onClose={vi.fn()} onDone={vi.fn()} />)
    expect(await screen.findByText("Couldn't load the project's sites: Failed to fetch properties")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('searchbox')).toBeInTheDocument()
  })

  it('cancels', async () => {
    const { onClose } = await renderPicker()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })
})
