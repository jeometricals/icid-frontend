import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConcMixTrucksTable from '../ConcMixTrucksTable'
import { RedlineProvider } from '../../../contexts/RedlineContext'

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

  describe('in review', () => {
    const REPORT = 'rep-mix'
    const SAVED = [truck({ id: 'truck-1', truckOrTicketNo: 'T-101', slump: '4' }), truck({ id: 'truck-2', truckOrTicketNo: 'T-102', inspectionSticker: 'Y' })]
    const ADDED = {
      edit_id: 'add-1', report_id: REPORT, field_path: 'trucks[truck-2]', edit_type: 'truck_add', old_value: null,
      new_value: SAVED[1], editor_initials: 'OE', editor_name: 'Olive Engineer',
    }
    let addTruck

    function renderInReview({ trucks = SAVED, edits = [], canEdit = true } = {}) {
      addTruck = addTruck ?? vi.fn().mockResolvedValue({ ok: true })
      const handlers = { onAddTruck: vi.fn(), onTruckChange: vi.fn(), onRemoveTruck: vi.fn() }
      render(
        <RedlineProvider value={{ reportId: REPORT, edits, isDraft: false, canEdit, saveField: vi.fn(), addTruck }}>
          <ConcMixTrucksTable trucks={trucks} {...handlers} disabled />
        </RedlineProvider>
      )
      return handlers
    }
    const addButton = () => screen.getByRole('button', { name: 'Add Truck' })
    const newRow = () => screen.queryByTestId('new-truck-row')

    beforeEach(() => { addTruck = undefined })

    it('keeps Add Truck disabled until edit mode is on', () => {
      renderInReview({ canEdit: false })
      expect(addButton()).toBeDisabled()
    })

    it('opens a blank row with Save and Cancel in edit mode, leaving the saved trucks disabled and unremovable', async () => {
      const { onAddTruck } = renderInReview()
      const user = userEvent.setup()
      await user.click(addButton())
      expect(onAddTruck).not.toHaveBeenCalled() // the form's own add is the inspector's
      expect(within(newRow()).getAllByRole('textbox')).toHaveLength(5)
      expect(within(newRow()).getAllByRole('spinbutton')).toHaveLength(5)
      expect(within(newRow()).getAllByRole('radio')).toHaveLength(3)
      for (const input of within(newRow()).getAllByRole('textbox')) expect(input).toBeEnabled()
      expect(screen.getByLabelText('New truck Truck or Ticket No')).toHaveValue('')
      expect(screen.getByLabelText('Truck 1 Truck or Ticket No')).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Remove truck 1' })).toBeDisabled()
      expect(addButton()).toBeDisabled() // one new truck at a time
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled() // nothing filled in yet
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    })

    it('needs a truck or ticket number or a slump before it will save', async () => {
      renderInReview()
      const user = userEvent.setup()
      await user.click(addButton())
      await user.type(screen.getByLabelText('New truck Load Size C.Y.'), '9')
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
      await user.type(screen.getByLabelText('New truck Slump'), '4.5')
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
      await user.clear(screen.getByLabelText('New truck Slump'))
      await user.type(screen.getByLabelText('New truck Truck or Ticket No'), ' ')
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    })

    it('adds the truck with the keys the report stores and closes the row', async () => {
      renderInReview()
      const user = userEvent.setup()
      await user.click(addButton())
      await user.type(screen.getByLabelText('New truck Truck or Ticket No'), 'T-103')
      await user.click(radio('New truck Inspection Sticker: N/A'))
      await user.type(screen.getByLabelText('New truck Slump'), '4.5')
      await user.click(screen.getByRole('button', { name: 'Save' }))
      expect(addTruck).toHaveBeenCalledWith(truck({ truckOrTicketNo: 'T-103', inspectionSticker: 'NA', slump: '4.5' }))
      await waitFor(() => expect(newRow()).not.toBeInTheDocument())
      expect(addButton()).toBeEnabled()
    })

    it('keeps the row open with the reason when the add is refused', async () => {
      addTruck = vi.fn().mockResolvedValue({ ok: false, message: 'This report is not a Concrete Truck & Mix Info' })
      renderInReview()
      const user = userEvent.setup()
      await user.click(addButton())
      await user.type(screen.getByLabelText('New truck Slump'), '4')
      await user.click(screen.getByRole('button', { name: 'Save' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('This report is not a Concrete Truck & Mix Info')
      expect(screen.getByLabelText('New truck Slump')).toHaveValue(4)
    })

    it('closes on a conflict: the page has reloaded and said so', async () => {
      addTruck = vi.fn().mockResolvedValue({ ok: false, conflict: true })
      renderInReview()
      const user = userEvent.setup()
      await user.click(addButton())
      await user.type(screen.getByLabelText('New truck Slump'), '4')
      await user.click(screen.getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(newRow()).not.toBeInTheDocument())
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('adds nothing on Cancel', async () => {
      renderInReview()
      const user = userEvent.setup()
      await user.click(addButton())
      await user.type(screen.getByLabelText('New truck Slump'), '4')
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(newRow()).not.toBeInTheDocument()
      expect(addTruck).not.toHaveBeenCalled()
    })

    it('opens the blank row in place of the empty state', async () => {
      renderInReview({ trucks: [] })
      await userEvent.setup().click(addButton())
      expect(newRow()).toBeInTheDocument()
      expect(screen.queryByText(/No trucks yet/)).not.toBeInTheDocument()
    })

    it('draws a truck a reviewer added in blue, with the adder\'s initials after its ticket number', () => {
      renderInReview({ edits: [ADDED], canEdit: false })
      const [first, second] = screen.getAllByTestId('truck-row')
      expect(first).not.toHaveAttribute('data-added')
      expect(second).toHaveAttribute('data-added', 'true')
      for (const input of [...within(second).getAllByRole('textbox'), ...within(second).getAllByRole('spinbutton')]) {
        expect(input).toHaveClass('text-[#0070C0]')
      }
      expect(within(second).getByText('N/A')).toHaveClass('text-[#0070C0]')
      expect(screen.getByLabelText('Truck 1 Truck or Ticket No')).not.toHaveClass('text-[#0070C0]')
      const ticketCell = within(second).getAllByRole('cell')[0]
      expect(within(ticketCell).getByText('OE')).toHaveAttribute('title', 'Olive Engineer')
      expect(within(first).queryByText('OE')).not.toBeInTheDocument()
    })

    it('keeps a pencil on every cell of an added truck, and chains a later edit on top', () => {
      const laterEdit = {
        edit_id: 'e2', report_id: REPORT, field_path: 'trucks[1].slump', edit_type: 'field_change', old_value: '',
        new_value: '5', editor_initials: 'RR', editor_name: 'Rex Resident',
      }
      renderInReview({ trucks: [SAVED[0], { ...SAVED[1], slump: '5' }], edits: [ADDED, laterEdit] })
      const second = screen.getAllByTestId('truck-row')[1]
      expect(within(second).getAllByRole('button', { name: /^Edit Truck 2 / })).toHaveLength(11)
      expect([...within(second).getByTestId('redline').children].map(line => line.textContent)).toEqual(['(blank)', '5RR'])
    })

    it("ignores another report's truck_add", () => {
      renderInReview({ edits: [{ ...ADDED, report_id: 'rep-other' }], canEdit: false })
      expect(screen.getAllByTestId('truck-row')[1]).not.toHaveAttribute('data-added')
    })
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
