import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ConcCylReportPage from '../ConcCylReportPage'
import * as api from '../../../services/api'
import * as AuthContext from '../../../contexts/AuthContext'
import { ProjectRolesContext } from '../../../contexts/ProjectRolesContext'
import { EditModeProvider } from '../../../contexts/RedlineContext'
import { NO_CYLINDER_ID } from '../../../components/reports/ConcCylCylindersTable'
import { TEST_USER } from '../../../test/users'

// ---------------------------------------------------------------------------
// The Conc Cyl addendum in review: its fields take reviewer edits by their stored paths, a cylinder's by its id.
// A tiny in-memory "server" applies each edit the way the backend does: the report holds the new value and the
// edit is added to field_edits.
// ---------------------------------------------------------------------------

const IDR_ID = 'idr-1'
const REPORT_ID = 'rep-cyl'
const PARENT_ID = 'rep-swcb'
const REPORT_URL = `/project/HWS0023/idr/${IDR_ID}/conc-cyl/${REPORT_ID}`
const OLIVE = { ...TEST_USER, uuid: 'f0000000-0000-4000-8000-000000000006', first_name: 'Olive', last_name: 'Engineer' }
const RENE = { ...TEST_USER, uuid: 'f0000000-0000-4000-8000-000000000007', first_name: 'Rene', last_name: 'Engineer' }

function reportData() {
  return {
    deliveryCasting: { dateOfDelivery: '2026-09-26', cyPoured: '12.5', dateCast: '2026-09-27', jobLocation: 'Main St' },
    sheetNo: '1',
    sheetOf: '2',
    cylinders: [
      { id: 'cyl-aaa', class: '40', cylinderNo: 'A-1', slump: '4.5' },
      { id: 'cyl-bbb', class: '40', cylinderNo: 'A-2', slump: '4' },
    ],
    placementLocation: 'Pier 3',
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
      { report_id: REPORT_ID, idr_id: IDR_ID, report_type: 'CONC_CYL', is_addendum: true, parent_report_id: PARENT_ID,
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
let editor

// The object holding a path's last key, and that key: 'cylinders[cyl-bbb].slump' → [the cyl-bbb row, 'slump'],
// 'deliveryCasting.cyPoured' → [deliveryCasting, 'cyPoured'], 'sheetNo' → [report_data, 'sheetNo']
function locate(data, fieldPath) {
  const cylinderField = fieldPath.match(/^cylinders\[(.+)\]\.(\w+)$/)
  if (cylinderField) return [data.cylinders.find(c => c.id === cylinderField[1]), cylinderField[2]]
  const keys = fieldPath.split('.')
  return [keys.slice(0, -1).reduce((node, key) => node[key], data), keys[keys.length - 1]]
}

beforeEach(() => {
  vi.clearAllMocks()
  nextEdit = 0
  editor = { uuid: OLIVE.uuid, initials: 'OE', name: 'Olive Engineer', stage: 'stage1' }
  server = idrAt('stage1_review')
  api.getIdr.mockImplementation(async () => structuredClone(server))
  api.getProjectById.mockResolvedValue({ project_id: 'HWS0023', project_name: 'S/W Queens 2025', borough: 'Queens' })
  api.getContractItems.mockResolvedValue([])
  api.editIdrField.mockImplementation(async (_, { fieldPath, newValue }) => {
    const [target, key] = locate(server.reports[1].report_data, fieldPath)
    nextEdit += 1
    server.field_edits.push({
      edit_id: `edit-${nextEdit}`, report_id: REPORT_ID, field_path: fieldPath, edit_type: 'field_change',
      old_value: target[key], new_value: newValue, editor_uuid: editor.uuid, editor_initials: editor.initials,
      editor_name: editor.name, editor_stage: editor.stage, edited_at: `2026-09-28T10:0${nextEdit}:00Z`,
    })
    target[key] = newValue
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
            <Route path="/project/:projectId/idr/:idrId/conc-cyl/:reportId" element={<ConcCylReportPage />} />
          </Routes>
        </EditModeProvider>
      </ProjectRolesContext.Provider>
    </MemoryRouter>
  )
}

const ready = () => screen.findByRole('heading', { name: 'Concrete Cylinder Data' })
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

describe('Conc Cyl report in review — edit mode', () => {
  it('reads as before with edit mode off: disabled inputs, no pencils, no redlines', async () => {
    renderPage()
    await ready()
    expect(toggle()).toHaveTextContent('Edit mode: off')
    expect(pencils()).toHaveLength(0)
    expect(redlines()).toEqual([])
    expect(screen.getByLabelText('C.Y. Poured')).toHaveValue(12.5)
    expect(screen.getByLabelText('C.Y. Poured')).toBeDisabled()
    expect(screen.getByLabelText('Cylinder 2 Slump')).toHaveValue('4')
    expect(screen.getByLabelText('Cylinder 2 Slump')).toBeDisabled()
  })

  it("offers the switch to the stage's reviewer and a pencil on every field once it is on", async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(toggle())
    // 4 delivery & casting + sheet no. + of + placement location + 2 cylinders × 3
    expect(pencils().map(p => p.getAttribute('aria-label'))).toHaveLength(4 + 2 + 1 + 6)
  })

  it('offers the switch to the RE who holds the IDR at Stage 2', async () => {
    server = idrAt('stage2_review', { re_reviewer_uuid: RENE.uuid })
    const user = userEvent.setup()
    renderPage({ user: RENE, roles: ['re'] })
    await ready()
    await user.click(toggle())
    expect(pencils()).toHaveLength(13)
  })

  it('offers nothing to the inspector, or to an OE once the IDR is at Stage 2', async () => {
    const { unmount } = renderPage({ user: TEST_USER, roles: ['inspector'] })
    await ready()
    expect(toggle()).not.toBeInTheDocument()
    expect(pencils()).toHaveLength(0)
    unmount()

    server = idrAt('stage2_review', { re_reviewer_uuid: RENE.uuid })
    renderPage()
    await ready()
    expect(toggle()).not.toBeInTheDocument()
  })

  it("keeps the form's own inputs, Add Cylinder, remove and the lab columns disabled in edit mode", async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(toggle())
    for (const input of [...screen.getAllByRole('textbox'), screen.getByRole('spinbutton')]) expect(input).toBeDisabled()
    expect(screen.getByLabelText('Date Cast')).toBeDisabled()
    expect(screen.getByLabelText('Cylinder 1 PSI (filled by the lab)')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add Cylinder' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove cylinder 1' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /^Edit Cylinder 1 PSI/ })).not.toBeInTheDocument()
  })
})

describe('Conc Cyl report in review — editing by the stored paths', () => {
  it("edits a cylinder's slump by the cylinder's id and shows it as a redline with initials", async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(toggle())
    await edit(user, 'Cylinder 2 Slump', retype(user, '4.5 in'))
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath: 'cylinders[cyl-bbb].slump', newValue: '4.5 in' })
    await waitFor(() => expect(redlines()).toEqual([['4', '4.5 inOE']]))
    expect(screen.queryByLabelText('Cylinder 2 Slump')).not.toBeInTheDocument() // the redline stands in for the input
    expect(screen.getByLabelText('Cylinder 1 Slump')).toHaveValue('4.5')
  })

  it('edits C.Y. Poured under deliveryCasting.cyPoured and shows the redline', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(toggle())
    await edit(user, 'C.Y. Poured', async (input) => {
      expect(input).toHaveAttribute('type', 'number')
      expect(input).toHaveValue(12.5)
      await retype(user, '14')(input)
    })
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath: 'deliveryCasting.cyPoured', newValue: '14' })
    await waitFor(() => expect(redlines()).toEqual([['12.5', '14OE']]))
  })

  it('edits a date in a date input, sending it as the report stores it', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(toggle())
    await edit(user, 'Date Cast', async (input) => {
      expect(input).toHaveAttribute('type', 'date')
      expect(input).toHaveValue('2026-09-27')
      await retype(user, '2026-09-28')(input)
    })
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath: 'deliveryCasting.dateCast', newValue: '2026-09-28' })
    await waitFor(() => expect(redlines()).toEqual([['2026-09-27', '2026-09-28OE']]))
  })

  it.each([
    ['Date of Delivery', 'deliveryCasting.dateOfDelivery', '2026-09-25'],
    ['Job Location', 'deliveryCasting.jobLocation', 'Elm St'],
    ['Sheet No.', 'sheetNo', '3'],
    ['Sheet No. of', 'sheetOf', '4'],
    ['Specific Location of Placement', 'placementLocation', 'Pier 4'],
    ['Cylinder 1 Class of Concrete', 'cylinders[cyl-aaa].class', '4000 PSI'],
    ['Cylinder 1 Cylinder #', 'cylinders[cyl-aaa].cylinderNo', 'C-14-A'],
    ['Cylinder 1 Slump', 'cylinders[cyl-aaa].slump', '5'],
  ])('saves %s under %s', async (label, fieldPath, newValue) => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(toggle())
    await edit(user, label, retype(user, newValue))
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath, newValue })
    await waitFor(() => expect(redlines()).toHaveLength(1))
    expect(within(screen.getByTestId('redline')).getByText('OE')).toBeInTheDocument()
  })

  it("chains the RE's edit after the OE's on the same cylinder", async () => {
    server = idrAt('stage2_review', { re_reviewer_uuid: RENE.uuid })
    server.reports[1].report_data.cylinders[1].slump = '4.5'
    server.field_edits.push({
      edit_id: 'e0', report_id: REPORT_ID, field_path: 'cylinders[cyl-bbb].slump', edit_type: 'field_change',
      old_value: '4', new_value: '4.5', editor_uuid: OLIVE.uuid, editor_initials: 'OE', editor_name: 'Olive Engineer',
      editor_stage: 'stage1', edited_at: '2026-09-28T09:00:00Z',
    })
    editor = { uuid: RENE.uuid, initials: 'RE', name: 'Rene Engineer', stage: 'stage2' }
    const user = userEvent.setup()
    renderPage({ user: RENE, roles: ['re'] })
    await ready()
    await user.click(toggle())
    await edit(user, 'Cylinder 2 Slump', retype(user, '5'))
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath: 'cylinders[cyl-bbb].slump', newValue: '5' })
    await waitFor(() => expect(redlines()).toEqual([['4', '4.5OE', '5RE']]))
  })

  it("shows the backend's reason under the input when an edit is refused", async () => {
    api.editIdrField.mockRejectedValue(Object.assign(new Error('Unknown field path'), { status: 400 }))
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(toggle())
    await user.click(screen.getByRole('button', { name: 'Edit Cylinder 1 Slump' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unknown field path')
    expect(screen.getByLabelText('New value for Cylinder 1 Slump')).toBeInTheDocument()
  })

  it('leaves a cylinder without an id read-only in edit mode', async () => {
    server.reports[1].report_data.cylinders.push({ class: '40', cylinderNo: 'A-3', slump: '4' })
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(toggle())
    expect(pencils()).toHaveLength(13) // nothing for the third row
    expect(screen.queryByRole('button', { name: /^Edit Cylinder 3/ })).not.toBeInTheDocument()
    const slump = screen.getByLabelText('Cylinder 3 Slump')
    expect(slump).toHaveValue('4')
    expect(slump).toBeDisabled()
    expect(slump.closest('td')).toHaveAttribute('title', NO_CYLINDER_ID)
  })

  it('shows the redlines to a reader with no edit mode', async () => {
    server.reports[1].report_data.cylinders[0].slump = '5'
    server.field_edits.push({
      edit_id: 'e1', report_id: REPORT_ID, field_path: 'cylinders[cyl-aaa].slump', edit_type: 'field_change',
      old_value: '4.5', new_value: '5', editor_uuid: OLIVE.uuid, editor_initials: 'OE', editor_name: 'Olive Engineer',
      editor_stage: 'stage1', edited_at: '2026-09-28T10:00:00Z',
    })
    renderPage({ user: TEST_USER, roles: ['inspector'] })
    await ready()
    expect(redlines()).toEqual([['4.5', '5OE']])
    expect(pencils()).toHaveLength(0)
  })
})
