import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConcMixTrucksTable from '../ConcMixTrucksTable'

const truck = (overrides = {}) => ({
  truckOrTicketNo: '', inspectionSticker: null, loadSizeCy: '', endBatch: '', mixingRevs: '', startDischTime: '',
  endDischTime: '', slump: '', airContent: '', concTemp: '', cylinderNumbers: '', ...overrides,
})

function renderTable(props = {}) {
  const handlers = { onAddTruck: vi.fn(), onTruckChange: vi.fn(), onRemoveTruck: vi.fn() }
  render(<ConcMixTrucksTable trucks={[]} {...handlers} {...props} />)
  return handlers
}

// Holds the trucks in state so clicks re-render, as the page does
function StatefulTable() {
  const [trucks, setTrucks] = useState([truck(), truck()])
  return (
    <ConcMixTrucksTable
      trucks={trucks}
      onAddTruck={() => {}}
      onTruckChange={(index, field, value) => setTrucks(t => t.map((row, i) => (i === index ? { ...row, [field]: value } : row)))}
      onRemoveTruck={() => {}}
    />
  )
}

const radio = (name) => screen.getByRole('radio', { name })

describe('ConcMixTrucksTable', () => {
  it('renders the 11 column headers plus a remove column, and the empty state', () => {
    renderTable()
    expect(screen.getByRole('heading', { name: 'Trucks' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual([
      'Truck or Ticket No', 'Inspection Sticker', 'Load Size C.Y.', 'End Batch', 'Mixing Revs', 'Start Disch. Time',
      'End Disch. Time', 'Slump', 'Air Content', 'Conc. Temp', 'Cylinder Numbers', 'Remove',
    ])
    const empty = screen.getByText("No trucks yet. Click 'Add Truck' to begin.")
    expect(empty).toHaveAttribute('colspan', '12')
  })

  it('calls onAddTruck from the Add Truck button', async () => {
    const { onAddTruck } = renderTable()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add Truck' }))
    expect(onAddTruck).toHaveBeenCalledTimes(1)
  })

  it('shows each truck row with text times and numeric measurements', () => {
    renderTable({ trucks: [truck({ truckOrTicketNo: 'T-101', startDischTime: '10:45 AM', slump: '4.5' })] })
    const row = within(screen.getByRole('table')).getAllByRole('row')[1]
    expect(within(row).getAllByRole('textbox')).toHaveLength(5) // ticket, end batch, two times, cylinders
    expect(within(row).getAllByRole('spinbutton')).toHaveLength(5) // load, revs, slump, air, temp
    expect(screen.getByLabelText('Truck 1 Truck or Ticket No')).toHaveValue('T-101')
    expect(screen.getByLabelText('Truck 1 Start Disch. Time')).toHaveValue('10:45 AM')
    expect(screen.getByLabelText('Truck 1 Slump')).toHaveValue(4.5)
    expect(screen.getByLabelText('Truck 1 Slump')).toHaveAttribute('step', '0.01')
  })

  it('calls onTruckChange(index, field, value) for fields and the sticker radios', async () => {
    const { onTruckChange } = renderTable({ trucks: [truck(), truck()] })
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Truck 2 Cylinder Numbers'), '7')
    expect(onTruckChange).toHaveBeenLastCalledWith(1, 'cylinderNumbers', '7')
    await user.click(radio('Truck 1 Inspection Sticker: N/A'))
    expect(onTruckChange).toHaveBeenLastCalledWith(0, 'inspectionSticker', 'NA')
  })

  it("keeps each truck's inspection sticker answer independent", async () => {
    render(<StatefulTable />)
    const user = userEvent.setup()
    await user.click(radio('Truck 1 Inspection Sticker: Y'))
    await user.click(radio('Truck 2 Inspection Sticker: N'))
    await user.click(radio('Truck 1 Inspection Sticker: N/A'))

    expect(radio('Truck 1 Inspection Sticker: N/A')).toBeChecked()
    expect(radio('Truck 1 Inspection Sticker: Y')).not.toBeChecked()
    expect(radio('Truck 2 Inspection Sticker: N')).toBeChecked()
  })

  it('calls onRemoveTruck(index) from the row × button', async () => {
    const { onRemoveTruck } = renderTable({ trucks: [truck(), truck()] })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove truck 2' }))
    expect(onRemoveTruck).toHaveBeenCalledWith(1)
  })

  it('disables Add Truck, every input, radio and × when disabled', () => {
    renderTable({ trucks: [truck()], disabled: true })
    expect(screen.getByRole('button', { name: 'Add Truck' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove truck 1' })).toBeDisabled()
    for (const input of [...screen.getAllByRole('textbox'), ...screen.getAllByRole('spinbutton'), ...screen.getAllByRole('radio')]) {
      expect(input).toBeDisabled()
    }
  })
})
