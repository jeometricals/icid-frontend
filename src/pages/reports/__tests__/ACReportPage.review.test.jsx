import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ACReportPage from '../ACReportPage'
import * as api from '../../../services/api'
import * as AuthContext from '../../../contexts/AuthContext'
import { ProjectRolesContext } from '../../../contexts/ProjectRolesContext'
import { EditModeProvider } from '../../../contexts/RedlineContext'
import { TEST_USER } from '../../../test/users'

// ---------------------------------------------------------------------------
// The AC report in review: its own sections take reviewer edits by their stored paths.
// A tiny in-memory "server" applies each edit the way the backend does: the report holds the new value and the
// edit is added to field_edits.
// ---------------------------------------------------------------------------

const IDR_ID = 'idr-1'
const REPORT_ID = 'rep-ac'
const REPORT_URL = `/project/HWS0023/idr/${IDR_ID}/ac/${REPORT_ID}`
const OLIVE = { ...TEST_USER, uuid: 'f0000000-0000-4000-8000-000000000006', first_name: 'Olive', last_name: 'Engineer' }

const course = (overrides) => ({
  itemNo: '', mixType: '', stationFrom: '', stationTo: '', lane: '', length: '', width: '', course: '', designDepth: '',
  area: '', weight: '', ...overrides,
})
const usage = (overrides) => ({
  noOfTickets: '', firstTicketNo: '', lastTicketNo: '', qtyReceived: '', qtyUsed: '', qtyWasted: '', ...overrides,
})
const REQUIREMENTS = [
  ['Subgrade Compacted per Spec or Approved Alternative', 'subgradeCompacted'],
  ['Roadway Subgrade/Base Surface Sufficiently Clean and Dry', 'roadwayCleanDry'],
  ['A/C Roller as per Spec or Approved Plan', 'acRollerPerSpec'],
  ['Density Tests Taken', 'densityTestsTaken'],
  ['Spot Check A/C Depth', 'spotCheckAcDepth'],
  ['Tack Coat Applied as per Spec', 'tackCoatPerSpec'],
  ['Tack Coat Applied on All Edges of Hardware', 'tackCoatOnEdges'],
]

function reportData() {
  return {
    pavingContractor: { pavingContractorName: 'Acme Paving', subcontractor: '', riceNo: '2.5' },
    temperature: { surfaceStart: '60', surfaceFinish: '', ambientStart: '', ambientFinish: '' },
    maxDensity: { top: '155', binder: '' },
    pavementCourses: [course({ itemNo: '4.02 AG', width: '12' }), course({ itemNo: '4.02 CA' })],
    materialUsageTop: usage({ noOfTickets: '3' }),
    materialUsageBinder: usage({ noOfTickets: '5' }),
    acRequirements: Object.fromEntries(REQUIREMENTS.map(([, key]) => [key, { value: '', remarks: '' }])),
    tackCoat: { noOfGallons: '', gallonsPerSy: '', applicationMethod: 'Spray' },
    deliveryTickets: [{ location: 'Sta 1+00', ticketNo: 'A-1', temperature: '300' }, { location: '', ticketNo: 'A-2', temperature: '' }],
    payItems: [],
  }
}

function idrAt(status) {
  const data = reportData()
  data.acRequirements.subgradeCompacted = { value: 'Y', remarks: 'Rolled' }
  return {
    idr_id: IDR_ID, project_id: 'HWS0023', report_date: '2026-09-27', status, submitted_at: '2026-09-27T20:00:00Z',
    work_start_time: '07:30:00', work_end_time: null, temp_low: null, temp_high: null, weather_am: 'Clear',
    weather_pm: null, total_pages: 1, idr_number: '005', stage1_reviewer_uuid: OLIVE.uuid, re_reviewer_uuid: null,
    field_edits: [],
    reports: [{
      report_id: REPORT_ID, idr_id: IDR_ID, report_type: 'AC', is_addendum: false, parent_report_id: null,
      page_number: 1, report_data: data,
    }],
  }
}

vi.mock('../../../services/api', () => ({
  getContractItems: vi.fn(), getIdr: vi.fn(), getProjectById: vi.fn(), saveReport: vi.fn(),
  editIdrField: vi.fn(), revisePayItem: vi.fn(), addPayItem: vi.fn(), approvePayItem: vi.fn(), addTruck: vi.fn(),
}))
vi.mock('../../../components/AttachmentsSection', () => ({ default: () => <div data-testid="attachments-section" /> }))

let server
let nextEdit

// 'pavementCourses[1].width' → ['pavementCourses', 1, 'width']
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
    const target = keys.slice(0, -1).reduce((node, key) => node[key], server.reports[0].report_data)
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
            <Route path="/project/:projectId/idr/:idrId/ac/:reportId" element={<ACReportPage />} />
          </Routes>
        </EditModeProvider>
      </ProjectRolesContext.Provider>
    </MemoryRouter>
  )
}

const ready = () => screen.findByRole('heading', { name: "Asphaltic Concrete Inspector's Report" })
const toggle = () => screen.queryByRole('button', { name: /^Edit mode:/ })
const pencil = (label) => screen.queryByRole('button', { name: `Edit ${label}` })
const redlines = () => screen.queryAllByTestId('redline').map(el => [...el.children].map(line => line.textContent))
const lastEdit = () => api.editIdrField.mock.calls.at(-1)[1]

// Opens a field's pencil, sets the inline input and saves; resolves once the edit has been sent
async function edit(user, label, change) {
  const sent = api.editIdrField.mock.calls.length
  await user.click(pencil(label))
  await change(screen.getByLabelText(`New value for ${label}`))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(api.editIdrField).toHaveBeenCalledTimes(sent + 1))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument())
}

const retype = (user, text) => async (input) => {
  await user.clear(input)
  await user.type(input, text)
}

async function openInEditMode(user) {
  renderPage()
  await ready()
  await user.click(toggle())
}

const COURSE_FIELDS = [
  ['Item No.', 'itemNo'], ['Mix Type', 'mixType'], ['Station From', 'stationFrom'], ['Station To', 'stationTo'],
  ['Lane', 'lane'], ['Length', 'length'], ['Width', 'width'], ['Course', 'course'], ['Design Depth', 'designDepth'],
  ['Area (S.Y.)', 'area'], ['Weight (Tons)', 'weight'],
]
const USAGE_FIELDS = [
  ['No. of Tickets', 'noOfTickets'], ['First Ticket No.', 'firstTicketNo'], ['Last Ticket No.', 'lastTicketNo'],
  ['Qty Received', 'qtyReceived'], ['Qty Used', 'qtyUsed'], ['Qty Wasted/Rejected', 'qtyWasted'],
]

// Every text / number field of the AC sections: [the pencil's label, its stored path]
const TEXT_FIELDS = [
  ['Paving Contractor Name', 'pavingContractor.pavingContractorName'],
  ['Subcontractor (if any)', 'pavingContractor.subcontractor'],
  ['Rice No. / Specific Gravity', 'pavingContractor.riceNo'],
  ['Surface Start', 'temperature.surfaceStart'],
  ['Surface Finish', 'temperature.surfaceFinish'],
  ['Ambient Start', 'temperature.ambientStart'],
  ['Ambient Finish', 'temperature.ambientFinish'],
  ['Max Density Top', 'maxDensity.top'],
  ['Max Density Binder', 'maxDensity.binder'],
  ...COURSE_FIELDS.map(([label, key]) => [`Course 2 ${label}`, `pavementCourses[1].${key}`]),
  ...USAGE_FIELDS.map(([label, key]) => [`Material Usage — Top: ${label}`, `materialUsageTop.${key}`]),
  ...USAGE_FIELDS.map(([label, key]) => [`Material Usage — Binder: ${label}`, `materialUsageBinder.${key}`]),
  ...REQUIREMENTS.map(([label, key]) => [`${label} Remarks`, `acRequirements.${key}.remarks`]),
  ['No. of Gallons', 'tackCoat.noOfGallons'],
  ['Gallons per S.Y.', 'tackCoat.gallonsPerSy'],
  ['Tack Coat Application Method / Type', 'tackCoat.applicationMethod'],
  ['Ticket 2 Location', 'deliveryTickets[1].location'],
  ['Ticket 2 Ticket No.', 'deliveryTickets[1].ticketNo'],
  ['Ticket 2 Temperature', 'deliveryTickets[1].temperature'],
]

describe('AC report in review — edit mode on its own sections', () => {
  it('shows no pencil until edit mode is on, then one on every field of the AC sections', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    expect(pencil('Surface Start')).not.toBeInTheDocument()
    await user.click(toggle())
    for (const [label] of TEXT_FIELDS) expect(pencil(label), label).toBeInTheDocument()
    for (const [label] of REQUIREMENTS) expect(pencil(label), label).toBeInTheDocument()
    for (const [label] of COURSE_FIELDS) expect(pencil(`Course 1 ${label}`), label).toBeInTheDocument()
    expect(pencil('Ticket 1 Temperature')).toBeInTheDocument()
  })

  it("keeps the sections' own inputs disabled, and offers the reviewer no row to add or remove", async () => {
    const user = userEvent.setup()
    await openInEditMode(user)
    expect(screen.getByLabelText('Paving Contractor Name')).toBeDisabled()
    expect(screen.getByLabelText('Surface Start')).toBeDisabled()
    expect(screen.getByLabelText('Course 1 Width')).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Density Tests Taken: Y' })).toBeDisabled()
    expect(screen.getByLabelText('Ticket 1 Temperature')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add Course' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add Ticket' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove course 1' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove ticket 1' })).toBeDisabled()
  })

  it('offers nothing to the inspector', async () => {
    renderPage({ user: TEST_USER, roles: ['inspector'] })
    await ready()
    expect(toggle()).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /^Edit (?!mode)/ })).toHaveLength(0)
  })
})

describe('AC report in review — editing by the stored paths', () => {
  it.each(TEXT_FIELDS)('saves %s under %s', async (label, fieldPath) => {
    const user = userEvent.setup()
    await openInEditMode(user)
    await edit(user, label, retype(user, '7'))
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath, newValue: '7' })
    await waitFor(() => expect(redlines()).toHaveLength(1))
    expect(redlines()[0].at(-1)).toBe('7OE')
  })

  it('edits the first course and the first ticket by their positions, as redlines in their cells', async () => {
    const user = userEvent.setup()
    await openInEditMode(user)
    await edit(user, 'Course 1 Width', retype(user, '14'))
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath: 'pavementCourses[0].width', newValue: '14' })
    await edit(user, 'Ticket 1 Temperature', retype(user, '295'))
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath: 'deliveryTickets[0].temperature', newValue: '295' })
    await waitFor(() => expect(redlines()).toEqual([['12', '14OE'], ['300', '295OE']]))
    expect(screen.queryByLabelText('Course 1 Width')).not.toBeInTheDocument() // the redline stands in for the input
    expect(screen.getByLabelText('Course 2 Width')).toBeInTheDocument()
  })

  it.each(REQUIREMENTS)('saves the answer of "%s" under acRequirements.%s.value', async (label, key) => {
    const user = userEvent.setup()
    await openInEditMode(user)
    await edit(user, label, select => user.selectOptions(select, 'N'))
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath: `acRequirements.${key}.value`, newValue: 'N' })
    await waitFor(() => expect(screen.getByRole('radio', { name: `${label}: N` })).toBeChecked())
    expect(redlines()).toHaveLength(1)
  })

  it('sends N/A as the stored key, reads it back as N/A, and clears an answer to blank', async () => {
    const user = userEvent.setup()
    await openInEditMode(user)
    const label = REQUIREMENTS[0][0]
    await edit(user, label, async (select) => {
      expect(select).toHaveValue('Y')
      await user.selectOptions(select, 'N/A')
    })
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath: 'acRequirements.subgradeCompacted.value', newValue: 'NA' })
    await waitFor(() => expect(redlines()).toEqual([['Y', 'N/AOE']]))

    await edit(user, label, select => user.selectOptions(select, '(blank)'))
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath: 'acRequirements.subgradeCompacted.value', newValue: '' })

    await edit(user, `${label} Remarks`, retype(user, 'Proof rolled'))
    expect(lastEdit()).toEqual({
      reportId: REPORT_ID, fieldPath: 'acRequirements.subgradeCompacted.remarks', newValue: 'Proof rolled',
    })
  })

  it('shows the redlines to a reader with no edit mode', async () => {
    server.reports[0].report_data.temperature.surfaceStart = '62'
    server.field_edits.push({
      edit_id: 'e1', report_id: REPORT_ID, field_path: 'temperature.surfaceStart', edit_type: 'field_change',
      old_value: '60', new_value: '62', editor_uuid: OLIVE.uuid, editor_initials: 'OE',
      editor_name: 'Olive Engineer', editor_stage: 'stage1', edited_at: '2026-09-28T10:00:00Z',
    })
    renderPage({ user: TEST_USER, roles: ['inspector'] })
    await ready()
    expect(redlines()).toEqual([['60', '62OE']])
  })
})
