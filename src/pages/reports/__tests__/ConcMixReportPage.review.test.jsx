import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ConcMixReportPage from '../ConcMixReportPage'
import * as api from '../../../services/api'
import * as AuthContext from '../../../contexts/AuthContext'
import { ProjectRolesContext } from '../../../contexts/ProjectRolesContext'
import { EditModeProvider } from '../../../contexts/RedlineContext'
import { TEST_USER } from '../../../test/users'

// ---------------------------------------------------------------------------
// The Conc Mix addendum in review: its own sections take reviewer edits by their stored paths.
// A tiny in-memory "server" applies each edit the way the backend does: the report holds the new value and the
// edit is added to field_edits.
// ---------------------------------------------------------------------------

const IDR_ID = 'idr-1'
const REPORT_ID = 'rep-mix'
const PARENT_ID = 'rep-swcb'
const REPORT_URL = `/project/HWS0023/idr/${IDR_ID}/conc-mix/${REPORT_ID}`
const OLIVE = { ...TEST_USER, uuid: 'f0000000-0000-4000-8000-000000000006', first_name: 'Olive', last_name: 'Engineer' }

function reportData() {
  return {
    locationOfUse: { curb: true, sidewalk: false, concreteBase: false, structural: false },
    mixerType: { type: 'readyMix', otherLabel: '' },
    trucks: [
      { truckOrTicketNo: 'T-101', inspectionSticker: 'Y', loadSizeCy: '10', endBatch: '', mixingRevs: '', startDischTime: '',
        endDischTime: '', slump: '4', airContent: '', concTemp: '', cylinderNumbers: '' },
      { truckOrTicketNo: 'T-102', inspectionSticker: null, loadSizeCy: '9', endBatch: '', mixingRevs: '', startDischTime: '',
        endDischTime: '', slump: '5', airContent: '', concTemp: '', cylinderNumbers: '' },
    ],
    concreteSpecs: { classOfConcrete: '40', slumpMin: '3', slumpMax: '5', airMin: '', airMax: '' },
    materialUsage: { batchReportNo: 'BR-9', noOfTickets: '2', firstTicketNo: '', lastTicketNo: '', quantityDispatched: '',
      quantityReceived: '', quantityUsed: '19', quantityWasted: '' },
    remarks: 'Poured north side',
  }
}

function idrAt(status, overrides = {}) {
  return {
    idr_id: IDR_ID, project_id: 'HWS0023', report_date: '2026-09-27', status, submitted_at: '2026-09-27T20:00:00Z',
    work_start_time: '07:30:00', work_end_time: null, temp_low: null, temp_high: null, weather_am: 'Clear',
    weather_pm: null, total_pages: 2, idr_number: '005', stage1_reviewer_uuid: OLIVE.uuid, re_reviewer_uuid: null,
    field_edits: [],
    reports: [
      { report_id: PARENT_ID, idr_id: IDR_ID, report_type: 'SWCB', is_addendum: false, parent_report_id: null,
        page_number: 1, report_data: {} },
      { report_id: REPORT_ID, idr_id: IDR_ID, report_type: 'CONC_MIX', is_addendum: true, parent_report_id: PARENT_ID,
        page_number: 2, report_data: reportData() },
    ],
    ...overrides,
  }
}

vi.mock('../../../services/api', () => ({
  getContractItems: vi.fn(), getIdr: vi.fn(), getProjectById: vi.fn(), saveReport: vi.fn(),
  editIdrField: vi.fn(), revisePayItem: vi.fn(), addPayItem: vi.fn(), approvePayItem: vi.fn(), addTruck: vi.fn(),
}))
vi.mock('../../../components/AttachmentsSection', () => ({ default: () => <div data-testid="attachments-section" /> }))

let server
let nextEdit

// 'trucks[1].slump' → ['trucks', 1, 'slump']
const keysOf = (fieldPath) => fieldPath.split(/[.[\]]+/).filter(Boolean).map(key => (/^\d+$/.test(key) ? Number(key) : key))

beforeEach(() => {
  vi.clearAllMocks()
  nextEdit = 0
  server = idrAt('stage1_review')
  api.getIdr.mockImplementation(async () => structuredClone(server))
  api.getProjectById.mockResolvedValue({ project_id: 'HWS0023', project_name: 'S/W Queens 2025', borough: 'Queens' })
  api.getContractItems.mockResolvedValue([])
  api.editIdrField.mockImplementation(async (_, { fieldPath, newValue }) => {
    const keys = keysOf(fieldPath)
    const target = keys.slice(0, -1).reduce((node, key) => node[key], server.reports[1].report_data)
    const last = keys[keys.length - 1]
    nextEdit += 1
    server.field_edits.push({
      edit_id: `edit-${nextEdit}`, report_id: REPORT_ID, field_path: fieldPath, edit_type: 'field_change',
      old_value: target[last], new_value: newValue, editor_uuid: OLIVE.uuid, editor_initials: 'OE',
      editor_name: 'Olive Engineer', editor_stage: 'stage1', edited_at: `2026-09-28T10:0${nextEdit}:00Z`,
    })
    target[last] = newValue
    return structuredClone(server)
  })
})

function renderPage({ user = OLIVE, roles = ['oe'] } = {}) {
  vi.spyOn(AuthContext, 'useOptionalAuth').mockReturnValue({ user })
  return render(
    <MemoryRouter initialEntries={[REPORT_URL]}>
      <ProjectRolesContext.Provider value={{ rolesByProject: { HWS0023: roles }, error: null, reload: () => {} }}>
        <EditModeProvider>
          <Routes>
            <Route path="/project/:projectId/idr/:idrId/conc-mix/:reportId" element={<ConcMixReportPage />} />
          </Routes>
        </EditModeProvider>
      </ProjectRolesContext.Provider>
    </MemoryRouter>
  )
}

const ready = () => screen.findByRole('heading', { name: 'Concrete Truck & Mix Info' })
const toggle = () => screen.queryByRole('button', { name: /^Edit mode:/ })
const pencils = () => screen.queryAllByRole('button', { name: /^Edit (?!mode)/ })
const redlines = () => screen.queryAllByTestId('redline').map(el => [...el.children].map(line => line.textContent))
const lastEdit = () => api.editIdrField.mock.calls.at(-1)[1]

// Opens a field's pencil, sets the inline input and saves; resolves once the edit has been sent
async function edit(user, label, change) {
  const sent = api.editIdrField.mock.calls.length
  await user.click(screen.getByRole('button', { name: `Edit ${label}` }))
  await change(screen.getByLabelText(`New value for ${label}`))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(api.editIdrField).toHaveBeenCalledTimes(sent + 1))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument())
}

const retype = (user, text) => async (input) => {
  await user.clear(input)
  await user.type(input, text)
}

describe('Conc Mix report in review — edit mode', () => {
  it('offers the switch to the stage\'s reviewer and a pencil on every field once it is on', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    expect(toggle()).toHaveTextContent('Edit mode: off')
    expect(pencils()).toHaveLength(0)
    await user.click(toggle())
    // 4 locations + mixer type + 2 trucks × 11 + 5 specs + 8 material usage + remarks
    expect(pencils().map(p => p.getAttribute('aria-label'))).toHaveLength(4 + 1 + 22 + 5 + 8 + 1)
  })

  it('offers nothing to the inspector', async () => {
    renderPage({ user: TEST_USER, roles: ['inspector'] })
    await ready()
    expect(toggle()).not.toBeInTheDocument()
    expect(pencils()).toHaveLength(0)
  })

  it("keeps the form's own inputs disabled in edit mode", async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(toggle())
    const inputs = [
      ...screen.getAllByRole('checkbox'), ...screen.getAllByRole('radio'), ...screen.getAllByRole('textbox'),
      ...screen.getAllByRole('spinbutton'),
    ]
    for (const input of inputs) expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove truck 1' })).toBeDisabled()
  })
})

describe('Conc Mix report in review — Add Truck', () => {
  const addButton = () => screen.getByRole('button', { name: 'Add Truck' })

  beforeEach(() => {
    // The backend appends the truck with an id of its own and logs it as added by the reviewer
    api.addTruck.mockImplementation(async (_, reportId, truck) => {
      const added = { ...truck, id: 'truck-new' }
      server.reports[1].report_data.trucks.push(added)
      server.field_edits.push({
        edit_id: 'add-1', report_id: reportId, field_path: `trucks[${added.id}]`, edit_type: 'truck_add',
        old_value: null, new_value: added, editor_uuid: OLIVE.uuid, editor_initials: 'OE',
        editor_name: 'Olive Engineer', editor_stage: 'stage1', edited_at: '2026-09-28T10:00:00Z',
      })
      return structuredClone(server)
    })
  })

  it('is disabled for the reviewer until edit mode is on, and for anyone else', async () => {
    const user = userEvent.setup()
    const { unmount } = renderPage()
    await ready()
    expect(addButton()).toBeDisabled()
    await user.click(toggle())
    expect(addButton()).toBeEnabled()
    unmount()
    renderPage({ user: TEST_USER, roles: ['inspector'] })
    await ready()
    expect(addButton()).toBeDisabled()
  })

  it("adds a truck with a ticket number and a slump, then shows it as a blue row with the reviewer's initials", async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(toggle())
    await user.click(addButton())
    await user.type(screen.getByLabelText('New truck Truck or Ticket No'), 'T-103')
    await user.type(screen.getByLabelText('New truck Slump'), '4.5')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getAllByTestId('truck-row')).toHaveLength(3))
    expect(api.addTruck).toHaveBeenCalledWith(IDR_ID, REPORT_ID, {
      truckOrTicketNo: 'T-103', inspectionSticker: null, loadSizeCy: '', endBatch: '', mixingRevs: '',
      startDischTime: '', endDischTime: '', slump: '4.5', airContent: '', concTemp: '', cylinderNumbers: '',
    })
    expect(screen.queryByTestId('new-truck-row')).not.toBeInTheDocument()
    const [first, , third] = screen.getAllByTestId('truck-row')
    expect(third).toHaveAttribute('data-added', 'true')
    expect(first).not.toHaveAttribute('data-added')
    expect(screen.getByLabelText('Truck 3 Truck or Ticket No')).toHaveValue('T-103')
    expect(screen.getByLabelText('Truck 3 Slump')).toHaveClass('text-[#0070C0]')
    expect(within(third).getByText('OE')).toBeInTheDocument()

    // its cells take later edits like any other truck's, by position
    await edit(user, 'Truck 3 Slump', retype(user, '5'))
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath: 'trucks[2].slump', newValue: '5' })
    await waitFor(() => expect(redlines()).toEqual([['4.5', '5OE']]))
  })

  it("shows the backend's reason under the row when the add is refused", async () => {
    api.addTruck.mockRejectedValue(Object.assign(new Error('The IDR is not in review'), { status: 400 }))
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(toggle())
    await user.click(addButton())
    await user.type(screen.getByLabelText('New truck Slump'), '4')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The IDR is not in review')
    expect(screen.getByTestId('new-truck-row')).toBeInTheDocument()
  })
})

describe('Conc Mix report in review — editing by the stored paths', () => {
  it('edits a truck\'s slump by the truck\'s position and shows it as a redline with initials', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(toggle())
    await edit(user, 'Truck 2 Slump', retype(user, '4.5'))
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath: 'trucks[1].slump', newValue: '4.5' })
    await waitFor(() => expect(redlines()).toEqual([['5', '4.5OE']]))
    expect(screen.queryByLabelText('Truck 2 Slump')).not.toBeInTheDocument() // the redline stands in for the input
    expect(screen.getByLabelText('Truck 1 Slump')).toHaveValue(4)
  })

  it('edits a truck\'s inspection sticker, sending the stored key', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(toggle())
    await edit(user, 'Truck 1 Inspection Sticker', async (select) => {
      expect(select).toHaveValue('Y')
      await user.selectOptions(select, 'N/A')
    })
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath: 'trucks[0].inspectionSticker', newValue: 'NA' })
    await waitFor(() => expect(redlines()).toEqual([['Y', 'N/AOE']]))
    expect(screen.getByRole('radio', { name: 'Truck 1 Inspection Sticker: N/A' })).toBeChecked()

    await edit(user, 'Truck 2 Inspection Sticker', select => user.selectOptions(select, 'N'))
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath: 'trucks[1].inspectionSticker', newValue: 'N' })
  })

  it('changes the mixer type from Ready Mix to Other, then types its label', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(toggle())
    expect(screen.queryByLabelText('Other mixer type')).not.toBeInTheDocument()
    await edit(user, 'Mixer Type', async (select) => {
      expect(select).toHaveValue('readyMix')
      await user.selectOptions(select, 'Other')
    })
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath: 'mixerType.type', newValue: 'other' })
    await waitFor(() => expect(redlines()).toEqual([['Ready Mix', 'OtherOE']]))
    expect(screen.getByRole('radio', { name: 'Other' })).toBeChecked()

    await edit(user, 'Other mixer type', retype(user, 'Volumetric'))
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath: 'mixerType.otherLabel', newValue: 'Volumetric' })
    await waitFor(() => expect(redlines()).toEqual([['(blank)', 'VolumetricOE'], ['Ready Mix', 'OtherOE']]))
  })

  it('edits a Location of Use checkbox as a boolean', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(toggle())
    await edit(user, 'Sidewalk', async (select) => {
      expect(select).toHaveValue('false')
      await user.selectOptions(select, 'Yes')
    })
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath: 'locationOfUse.sidewalk', newValue: true })
    await waitFor(() => expect(redlines()).toEqual([['No', 'YesOE']]))
    expect(screen.getByRole('checkbox', { name: 'Sidewalk' })).toBeChecked()

    await edit(user, 'Curb', select => user.selectOptions(select, 'No'))
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath: 'locationOfUse.curb', newValue: false })
  })

  it.each([
    ['Truck 1 Truck or Ticket No', 'trucks[0].truckOrTicketNo'],
    ['Truck 1 Load Size C.Y.', 'trucks[0].loadSizeCy'],
    ['Truck 1 End Batch', 'trucks[0].endBatch'],
    ['Truck 1 Mixing Revs', 'trucks[0].mixingRevs'],
    ['Truck 1 Start Disch. Time', 'trucks[0].startDischTime'],
    ['Truck 1 End Disch. Time', 'trucks[0].endDischTime'],
    ['Truck 1 Air Content', 'trucks[0].airContent'],
    ['Truck 1 Conc. Temp', 'trucks[0].concTemp'],
    ['Truck 1 Cylinder Numbers', 'trucks[0].cylinderNumbers'],
    ['Class of Concrete', 'concreteSpecs.classOfConcrete'],
    ['Slump Min', 'concreteSpecs.slumpMin'],
    ['Slump Max', 'concreteSpecs.slumpMax'],
    ['Air Min', 'concreteSpecs.airMin'],
    ['Air Max', 'concreteSpecs.airMax'],
    ['Batch Report No', 'materialUsage.batchReportNo'],
    ['No. of Tickets', 'materialUsage.noOfTickets'],
    ['First Ticket No', 'materialUsage.firstTicketNo'],
    ['Last Ticket No', 'materialUsage.lastTicketNo'],
    ['Quantity Dispatched from Plant', 'materialUsage.quantityDispatched'],
    ['Quantity Received', 'materialUsage.quantityReceived'],
    ['Quantity Used', 'materialUsage.quantityUsed'],
    ['Quantity Wasted / Rejected', 'materialUsage.quantityWasted'],
    ['Remarks', 'remarks'],
  ])('saves %s under %s', async (label, fieldPath) => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(toggle())
    await edit(user, label, retype(user, '7'))
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath, newValue: '7' })
    await waitFor(() => expect(redlines()).toHaveLength(1))
    expect(within(screen.getByTestId('redline')).getByText('OE')).toBeInTheDocument()
  })

  it('shows the redlines to a reader with no edit mode', async () => {
    server.reports[1].report_data.trucks[0].slump = '4.5'
    server.field_edits.push({
      edit_id: 'e1', report_id: REPORT_ID, field_path: 'trucks[0].slump', edit_type: 'field_change', old_value: '4',
      new_value: '4.5', editor_uuid: OLIVE.uuid, editor_initials: 'OE', editor_name: 'Olive Engineer',
      editor_stage: 'stage1', edited_at: '2026-09-28T10:00:00Z',
    })
    renderPage({ user: TEST_USER, roles: ['inspector'] })
    await ready()
    expect(redlines()).toEqual([['4', '4.5OE']])
    expect(pencils()).toHaveLength(0)
  })
})
