import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SWCBReportPage from '../SWCBReportPage'
import * as api from '../../../services/api'
import * as AuthContext from '../../../contexts/AuthContext'
import { ProjectRolesContext } from '../../../contexts/ProjectRolesContext'
import { EditModeProvider } from '../../../contexts/RedlineContext'
import { TEST_USER } from '../../../test/users'

// ---------------------------------------------------------------------------
// The SWCB report in review: its own sections (Operation, Detailed Activity, Inspection Matrix) take reviewer edits
// by their stored paths. A tiny in-memory "server" applies each edit the way the backend does: the report holds the
// new value and the edit is added to field_edits.
// ---------------------------------------------------------------------------

const IDR_ID = 'idr-1'
const REPORT_ID = 'rep-swcb'
const REPORT_URL = `/project/HWS0023/idr/${IDR_ID}/swcb/${REPORT_ID}`
const OLIVE = { ...TEST_USER, uuid: 'f0000000-0000-4000-8000-000000000006', first_name: 'Olive', last_name: 'Engineer' }

function reportData() {
  return {
    description: 'Poured curb',
    structural: false,
    subcontractor: 'Acme Paving',
    activity: {
      excavation: { fromStation: '1+00', toStation: '2+00', remarks: '' },
      formPrep: { fromStation: '', toStation: '', remarks: '' },
      pour: { fromStation: '', toStation: '', remarks: 'North side' },
    },
    inspectionMatrix: {
      subgradeCompacted: { base: 'Y', sidewalk: 'Y', curb: null },
      compactionTestTaken: { base: null, sidewalk: null, curb: null },
      sidewalkFoundationPlaced: { base: null, sidewalk: 'N', curb: null },
      roadwayStoneBasePlaced: { base: 'NA', sidewalk: null, curb: null },
      curingCompoundApplied: { base: null, sidewalk: null, curb: null },
      otherCuringMethods: { base: '', sidewalk: 'Wet burlap', curb: '' },
      rebarInstalled: { base: null, sidewalk: null, curb: null },
    },
    payItems: [],
  }
}

function idrAt(status) {
  return {
    idr_id: IDR_ID, project_id: 'HWS0023', report_date: '2026-09-27', status, submitted_at: '2026-09-27T20:00:00Z',
    work_start_time: '07:30:00', work_end_time: null, temp_low: null, temp_high: null, weather_am: 'Clear',
    weather_pm: null, total_pages: 1, idr_number: '005', stage1_reviewer_uuid: OLIVE.uuid, re_reviewer_uuid: null,
    field_edits: [],
    reports: [{
      report_id: REPORT_ID, idr_id: IDR_ID, report_type: 'SWCB', is_addendum: false, parent_report_id: null,
      page_number: 1, report_data: reportData(),
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

beforeEach(() => {
  vi.clearAllMocks()
  nextEdit = 0
  server = idrAt('stage1_review')
  api.getIdr.mockImplementation(async () => structuredClone(server))
  api.getProjectById.mockResolvedValue({ project_id: 'HWS0023', project_name: 'S/W Queens 2025', borough: 'Queens' })
  api.getContractItems.mockResolvedValue([])
  api.editIdrField.mockImplementation(async (_, { fieldPath, newValue }) => {
    const keys = fieldPath.split('.')
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
            <Route path="/project/:projectId/idr/:idrId/swcb/:reportId" element={<SWCBReportPage />} />
          </Routes>
        </EditModeProvider>
      </ProjectRolesContext.Provider>
    </MemoryRouter>
  )
}

const ready = () => screen.findByRole('heading', { name: "Sidewalk, Curb, Concrete Base Inspector's Report" })
const toggle = () => screen.queryByRole('button', { name: /^Edit mode:/ })
const pencil = (label) => screen.queryByRole('button', { name: `Edit ${label}` })
const redlines = () => screen.queryAllByTestId('redline').map(el => [...el.children].map(line => line.textContent))
const lastEdit = () => api.editIdrField.mock.calls.at(-1)[1]

const FOUNDATION = 'Sidewalk 6" Foundation Material Placed and Compacted'
const STONE_BASE = 'Roadway Stone Base Placed and Compacted'

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

describe('SWCB report in review — edit mode on its own sections', () => {
  it('shows no pencil until edit mode is on, then one on every field that takes an answer', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    expect(pencil('Structural')).not.toBeInTheDocument()
    await user.click(toggle())
    const own = screen.getAllByRole('button', { name: /^Edit / }).map(b => b.getAttribute('aria-label'))
      .filter(label => /^Edit (Structural|Subcontractor|Excavation|Form \/ Prep|Pour) ?|, (Base|Sidewalk|Curb)$/.test(label))
    // structural + subcontractor + 3×3 activity + 15 answer cells + 3 text cells
    expect(own).toHaveLength(1 + 1 + 9 + 15 + 3)
  })

  it('offers no pencil on the matrix cells the form greys out', async () => {
    const user = userEvent.setup()
    await openInEditMode(user)
    expect(pencil(`${FOUNDATION}, Base`)).toBeInTheDocument()
    expect(pencil(`${FOUNDATION}, Sidewalk`)).toBeInTheDocument()
    expect(pencil(`${FOUNDATION}, Curb`)).not.toBeInTheDocument()
    expect(pencil(`${STONE_BASE}, Base`)).toBeInTheDocument()
    expect(pencil(`${STONE_BASE}, Sidewalk`)).not.toBeInTheDocument()
    expect(pencil(`${STONE_BASE}, Curb`)).not.toBeInTheDocument()
  })

  it("keeps the sections' own inputs disabled in edit mode", async () => {
    const user = userEvent.setup()
    await openInEditMode(user)
    expect(screen.getByRole('checkbox', { name: 'Structural' })).toBeDisabled()
    expect(screen.getByLabelText('Subcontractor (if any)')).toBeDisabled()
    expect(screen.getByLabelText('Excavation From Station')).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Subgrade Compacted, Sidewalk: Y' })).toBeDisabled()
    expect(screen.getByLabelText('Other Curing Methods, Sidewalk')).toBeDisabled()
  })

  it('offers nothing to the inspector', async () => {
    renderPage({ user: TEST_USER, roles: ['inspector'] })
    await ready()
    expect(toggle()).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /^Edit (?!mode)/ })).toHaveLength(0)
  })
})

describe('SWCB report in review — editing by the stored paths', () => {
  it('edits the Structural checkbox as a boolean', async () => {
    const user = userEvent.setup()
    await openInEditMode(user)
    await edit(user, 'Structural', async (select) => {
      expect(select).toHaveValue('false')
      await user.selectOptions(select, 'Yes')
    })
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath: 'structural', newValue: true })
    await waitFor(() => expect(redlines()).toEqual([['No', 'YesOE']]))
    expect(screen.getByRole('checkbox', { name: 'Structural' })).toBeChecked()
  })

  it('edits the subcontractor and shows it as a redline in place of the input', async () => {
    const user = userEvent.setup()
    await openInEditMode(user)
    await edit(user, 'Subcontractor (if any)', retype(user, 'Zenith Concrete'))
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath: 'subcontractor', newValue: 'Zenith Concrete' })
    await waitFor(() => expect(redlines()).toEqual([['Acme Paving', 'Zenith ConcreteOE']]))
    expect(screen.queryByLabelText('Subcontractor (if any)')).not.toBeInTheDocument()
  })

  it.each([
    ['Excavation From Station', 'activity.excavation.fromStation'],
    ['Excavation To Station', 'activity.excavation.toStation'],
    ['Excavation Remarks', 'activity.excavation.remarks'],
    ['Form / Prep From Station', 'activity.formPrep.fromStation'],
    ['Form / Prep To Station', 'activity.formPrep.toStation'],
    ['Form / Prep Remarks', 'activity.formPrep.remarks'],
    ['Pour From Station', 'activity.pour.fromStation'],
    ['Pour To Station', 'activity.pour.toStation'],
    ['Pour Remarks', 'activity.pour.remarks'],
    ['Other Curing Methods, Base', 'inspectionMatrix.otherCuringMethods.base'],
    ['Other Curing Methods, Sidewalk', 'inspectionMatrix.otherCuringMethods.sidewalk'],
    ['Other Curing Methods, Curb', 'inspectionMatrix.otherCuringMethods.curb'],
  ])('saves %s under %s', async (label, fieldPath) => {
    const user = userEvent.setup()
    await openInEditMode(user)
    await edit(user, label, retype(user, '3+50'))
    expect(lastEdit()).toEqual({ reportId: REPORT_ID, fieldPath, newValue: '3+50' })
    await waitFor(() => expect(redlines()).toHaveLength(1))
    expect(redlines()[0].at(-1)).toBe('3+50OE')
  })

  it.each([
    ['Subgrade Compacted', 'subgradeCompacted', ['Base', 'Sidewalk', 'Curb']],
    ['Compaction Test Taken', 'compactionTestTaken', ['Base', 'Sidewalk', 'Curb']],
    [FOUNDATION, 'sidewalkFoundationPlaced', ['Base', 'Sidewalk']],
    [STONE_BASE, 'roadwayStoneBasePlaced', ['Base']],
    ['Curing Compound Applied', 'curingCompoundApplied', ['Base', 'Sidewalk', 'Curb']],
    ['Rebar Installed per Approved Shop Drawings and Bending Schedule?', 'rebarInstalled', ['Base', 'Sidewalk', 'Curb']],
  ])('saves each answer of %s under inspectionMatrix.%s.<column>', async (label, key, columns) => {
    const user = userEvent.setup()
    await openInEditMode(user)
    for (const column of columns) {
      const before = server.reports[0].report_data.inspectionMatrix[key][column.toLowerCase()]
      const answer = before === 'N' ? 'Y' : 'N'
      await edit(user, `${label}, ${column}`, select => user.selectOptions(select, answer))
      expect(lastEdit()).toEqual({
        reportId: REPORT_ID, fieldPath: `inspectionMatrix.${key}.${column.toLowerCase()}`, newValue: answer,
      })
      await waitFor(() => expect(screen.getByRole('radio', { name: `${label}, ${column}: ${answer}` })).toBeChecked())
    }
    expect(redlines()).toHaveLength(columns.length)
  })

  it('sends N/A as the stored key, reads it back as N/A, and clears an answer to null', async () => {
    const user = userEvent.setup()
    await openInEditMode(user)
    await edit(user, 'Subgrade Compacted, Sidewalk', async (select) => {
      expect(select).toHaveValue('Y')
      await user.selectOptions(select, 'N/A')
    })
    expect(lastEdit()).toEqual({
      reportId: REPORT_ID, fieldPath: 'inspectionMatrix.subgradeCompacted.sidewalk', newValue: 'NA',
    })
    await waitFor(() => expect(redlines()).toEqual([['Y', 'N/AOE']]))

    await edit(user, 'Subgrade Compacted, Base', select => user.selectOptions(select, '(blank)'))
    expect(lastEdit()).toEqual({
      reportId: REPORT_ID, fieldPath: 'inspectionMatrix.subgradeCompacted.base', newValue: null,
    })
  })

  it('shows the redlines to a reader with no edit mode', async () => {
    server.reports[0].report_data.activity.excavation.fromStation = '1+50'
    server.field_edits.push({
      edit_id: 'e1', report_id: REPORT_ID, field_path: 'activity.excavation.fromStation', edit_type: 'field_change',
      old_value: '1+00', new_value: '1+50', editor_uuid: OLIVE.uuid, editor_initials: 'OE',
      editor_name: 'Olive Engineer', editor_stage: 'stage1', edited_at: '2026-09-28T10:00:00Z',
    })
    renderPage({ user: TEST_USER, roles: ['inspector'] })
    await ready()
    expect(redlines()).toEqual([['1+00', '1+50OE']])
  })
})
