import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PropertyPickerModal from '../PropertyPickerModal'
import * as api from '../../services/api'

vi.mock('../../services/api', () => ({ listProperties: vi.fn(), bundleProperty: vi.fn() }))

const property = (number, bbl, address, property_type = '1_3_family') => ({
  id: `c0000000-0000-4000-8000-00000000000${number}`, project_id: 'HWS0023', bbl, address, property_type,
  notes: null, created_at: '2026-09-14T12:00:00Z', deleted_at: null,
})
const ELM = property(1, '4001110001', '7 Elm Pl')
const MAIN = property(2, '4001230045', '12 Main St', '4_plus_family')
const MAPLE = property(3, '4009990003', '3 Maple Rd', 'expedited')
const OAK = property(4, '4001230099', '40 Oak Ave')
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

const box = (bbl) => screen.getByRole('checkbox', { name: new RegExp(bbl) })
const shownBbls = () => screen.getAllByRole('checkbox').map(input => input.closest('label').textContent.slice(0, 10))
const search = () => screen.getByRole('searchbox', { name: 'Search by BBL or address' })

describe('PropertyPickerModal', () => {
  it('lists the project\'s live properties that aren\'t already in the task order, with BBL, address and type', async () => {
    await renderPicker()
    expect(api.listProperties).toHaveBeenCalledWith('HWS0023')
    expect(shownBbls()).toEqual(['4001110001', '4001230045', '4009990003'])
    expect(screen.queryByRole('checkbox', { name: /4001230099/ })).not.toBeInTheDocument()
    expect(box('4001230045').closest('label')).toHaveTextContent('12 Main St')
    expect(box('4001230045').closest('label')).toHaveTextContent('4+ family / commercial')
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })

  it('filters by BBL or address, any case', async () => {
    await renderPicker()
    await userEvent.type(search(), 'MAIN')
    expect(shownBbls()).toEqual(['4001230045'])
    await userEvent.clear(search())
    await userEvent.type(search(), '400999')
    expect(shownBbls()).toEqual(['4009990003'])
    await userEvent.clear(search())
    await userEvent.type(search(), 'nowhere')
    expect(screen.getByText('No sites match "nowhere".')).toBeInTheDocument()
  })

  it('selects several, and "Select all shown" ticks only the rows the search shows', async () => {
    await renderPicker()
    await userEvent.click(box('4001110001'))
    expect(screen.getByRole('button', { name: 'Add 1 site' })).toBeEnabled()
    await userEvent.type(search(), 'Rd')
    await userEvent.click(screen.getByRole('button', { name: 'Select all shown' }))
    expect(screen.getByRole('button', { name: 'Select all shown' })).toBeDisabled()
    await userEvent.clear(search())
    expect(box('4001110001')).toBeChecked()
    expect(box('4009990003')).toBeChecked()
    expect(box('4001230045')).not.toBeChecked()
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
