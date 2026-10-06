import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import GeneralReportPage from '../GeneralReportPage'
import * as api from '../../../services/api'
import * as AuthContext from '../../../contexts/AuthContext'
import { ProjectRolesContext } from '../../../contexts/ProjectRolesContext'
import { EditModeProvider } from '../../../contexts/RedlineContext'
import { MOCK_CONTRACT_ITEMS } from '../../../test/contractItems'
import { TEST_USER } from '../../../test/users'

// ---------------------------------------------------------------------------
// A report page in review: redlines for everyone, editing for the stage's reviewer.
// A tiny in-memory "server" applies each edit the way the backend does: the report holds the new value and the
// edit is added to field_edits.
// ---------------------------------------------------------------------------

const IDR_ID = 'idr-1'
const REPORT_ID = 'rep-gen'
const REPORT_URL = `/project/HWS0023/idr/${IDR_ID}/general/${REPORT_ID}`
const OLIVE = { ...TEST_USER, uuid: 'f0000000-0000-4000-8000-000000000006', first_name: 'Olive', last_name: 'Engineer' }
const REX = { ...TEST_USER, uuid: 'f0000000-0000-4000-8000-000000000007', first_name: 'Rex', last_name: 'Resident' }
const INITIALS = { [OLIVE.uuid]: 'OE', [REX.uuid]: 'RR' }

function reportData() {
  return {
    description: 'Poured curb',
    comments: '',
    payItems: [
      { id: 'item-1', itemNo: '4.13 AAS', budgetCode: '12345', payQuantity: '60.00', unit: 'S.F.', description: 'Sidewalk' },
      { id: 'item-2', itemNo: '4.08 AA', budgetCode: '12345', payQuantity: '29.00', unit: 'L.F.', description: 'Curb' },
    ],
    workforce: { superintendent: '1', foremen: '2', operators: '', laborers: '6', flaggers: '' },
    additionalWorkforce: [{ label: 'Masons', count: '3' }],
    equipment: {
      frontEndLoader: { model: '', number: '' }, backhoe: { model: 'CAT 420', number: '1' },
      truckDump: { model: '', number: '' }, compressor: { model: '', number: '' }, excavator: { model: '', number: '' },
    },
    additionalEquipment: [],
    safetyChecks: {
      plasticBarrels: 'Y', pedestrianBarricades: null, timberCurbs: null, timberBreakawayBarricades: null,
      generalSafety: null, localEmergencyAccess: null, fencing: null, plates: null, arrowBoard: null, siteCleaned: null,
    },
    safetyRemarks: { plasticBarrels: '' },
  }
}

function idrAt(status, overrides = {}) {
  return {
    idr_id: IDR_ID, project_id: 'HWS0023', report_date: '2026-09-27', status, submitted_at: '2026-09-27T20:00:00Z',
    work_start_time: '07:30:00', work_end_time: null, temp_low: null, temp_high: null, weather_am: 'Clear',
    weather_pm: null, total_pages: 1, idr_number: '005',
    stage1_reviewer_uuid: OLIVE.uuid, re_reviewer_uuid: status === 'stage2_review' ? REX.uuid : null,
    field_edits: [],
    reports: [{
      report_id: REPORT_ID, idr_id: IDR_ID, report_type: 'GEN', is_addendum: false, parent_report_id: null,
      page_number: 1, report_data: reportData(), is_auto_generated: false,
      created_at: '2026-09-25T13:00:00Z', updated_at: '2026-09-25T13:00:00Z',
    }],
    ...overrides,
  }
}

vi.mock('../../../services/api', () => ({
  getContractItems: vi.fn(), getIdr: vi.fn(), getProjectById: vi.fn(), saveReport: vi.fn(),
  editIdrField: vi.fn(), revisePayItem: vi.fn(), addPayItem: vi.fn(),
}))
vi.mock('../../../components/AttachmentsSection', () => ({ default: () => <div data-testid="attachments-section" /> }))

let server
let signedIn
let nextEdit

// Writes a value at a path such as ['workforce', 'foremen'] or ['payItems', 0, 'payQuantity'] and returns the old one
function setAt(data, path, value) {
  const target = path.slice(0, -1).reduce((node, key) => node[key], data)
  const old = target[path[path.length - 1]]
  target[path[path.length - 1]] = value
  return old
}

function record(fieldPath, editType, oldValue, newValue) {
  nextEdit += 1
  server.field_edits.push({
    edit_id: `edit-${nextEdit}`, report_id: REPORT_ID, field_path: fieldPath, edit_type: editType, old_value: oldValue,
    new_value: newValue, editor_uuid: signedIn.uuid, editor_initials: INITIALS[signedIn.uuid],
    editor_name: `${signedIn.first_name} ${signedIn.last_name}`,
    editor_stage: server.status === 'stage1_review' ? 'stage1' : 'stage2', edited_at: `2026-09-28T10:0${nextEdit}:00Z`,
  })
  return structuredClone(server)
}

// 'workforce.foremen' → ['workforce', 'foremen']; 'payItems[item-2].budgetCode' → ['payItems', 1, 'budgetCode']
function locate(data, fieldPath) {
  return fieldPath.split('.').flatMap(part => {
    const [, key, bracket] = part.match(/^([A-Za-z]+)(?:\[(.+)\])?$/)
    if (bracket === undefined) return [key]
    return [key, key === 'payItems' ? data.payItems.findIndex(item => item.id === bracket) : Number(bracket)]
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  nextEdit = 0
  signedIn = OLIVE
  server = idrAt('stage1_review')
  api.getIdr.mockImplementation(async () => structuredClone(server))
  api.getProjectById.mockResolvedValue({ project_id: 'HWS0023', project_name: 'S/W Queens 2025', borough: 'Queens' })
  api.getContractItems.mockResolvedValue(MOCK_CONTRACT_ITEMS)
  api.editIdrField.mockImplementation(async (_, { fieldPath, newValue }) => {
    const data = server.reports[0].report_data
    const old = setAt(data, locate(data, fieldPath), newValue)
    return record(fieldPath, fieldPath.endsWith('.payQuantity') ? 'pay_item_revision' : 'field_change', old, newValue)
  })
  api.revisePayItem.mockImplementation(async (_, itemId, quantity) => {
    const item = server.reports[0].report_data.payItems.find(i => i.id === itemId)
    const old = item.payQuantity
    item.payQuantity = quantity
    return record(`payItems[${itemId}].payQuantity`, 'pay_item_revision', old, quantity)
  })
  api.addPayItem.mockImplementation(async (_, { itemNo, budgetCode, quantity, unit, description }) => {
    const item = { id: `added-${nextEdit + 1}`, itemNo, budgetCode, payQuantity: quantity, unit, description }
    server.reports[0].report_data.payItems.push(item)
    return record(`payItems[${item.id}]`, 'pay_item_add', null, item)
  })
})

function renderPage({ user = OLIVE, roles = ['oe', 're'] } = {}) {
  signedIn = user
  vi.spyOn(AuthContext, 'useOptionalAuth').mockReturnValue({ user })
  return render(
    <MemoryRouter initialEntries={[REPORT_URL]}>
      <ProjectRolesContext.Provider value={{ rolesByProject: { HWS0023: roles }, error: null, reload: () => {} }}>
        <EditModeProvider>
          <Routes>
            <Route path="/project/:projectId/idr/:idrId/general/:reportId" element={<GeneralReportPage />} />
          </Routes>
        </EditModeProvider>
      </ProjectRolesContext.Provider>
    </MemoryRouter>
  )
}

const ready = () => screen.findByRole('heading', { name: "General Inspector's Report" })
const toggle = () => screen.queryByRole('button', { name: /^Edit mode:/ })
// Every field's pencil (the edit-mode switch's own label starts with "Edit mode")
const pencils = () => screen.queryAllByRole('button', { name: /^Edit (?!mode)/ })
const payRows = () => screen.getAllByTestId(/^pay-item-/).map(row => [
  row.dataset.testid, within(row).getAllByRole('cell')[2].textContent,
])
// The redline of the field whose pencil or control carries this label: the description is the first on the page
const redlines = () => screen.queryAllByTestId('redline').map(el => [...el.children].map(line => line.textContent))

async function turnOnEditMode(user) {
  await ready()
  await user.click(toggle())
}

// ---------------------------------------------------------------------------
// The edit-mode switch
// ---------------------------------------------------------------------------

describe('report page in review — edit mode', () => {
  it('is offered to the reviewer who accepted the IDR, off by default, with no pencils until it is on', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    expect(toggle()).toHaveTextContent('Edit mode: off')
    expect(toggle()).toHaveAttribute('aria-pressed', 'false')
    expect(pencils()).toHaveLength(0)
    await user.click(toggle())
    expect(toggle()).toHaveTextContent('Edit mode: on')
    expect(pencils().length).toBeGreaterThan(10) // the description, the workforce, the checklist, the pay-item fields...
  })

  it.each([
    ['the inspector', TEST_USER, ['inspector']],
    ['another reviewer on the project', REX, ['oe', 're']],
    ['the reviewer once their role is gone', OLIVE, ['inspector']],
  ])('is not offered to %s', async (_, user, roles) => {
    renderPage({ user, roles })
    await ready()
    expect(toggle()).not.toBeInTheDocument()
    expect(pencils()).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /Revise|Add Pay Item/ })).not.toBeInTheDocument()
  })

  it('is offered to an admin with no project role', async () => {
    renderPage({ user: { ...REX, role: 'admin' }, roles: [] })
    await ready()
    expect(toggle()).toBeInTheDocument()
  })

  it.each(['submitted', 'approved'])('is not offered on a %s IDR, even to its reviewer', async (status) => {
    server = idrAt(status, { re_reviewer_uuid: OLIVE.uuid })
    renderPage()
    await ready()
    expect(toggle()).not.toBeInTheDocument()
  })

  it('goes to the RE at Stage 2 and not back to the Stage 1 reviewer', async () => {
    server = idrAt('stage2_review')
    const { unmount } = renderPage({ user: OLIVE })
    await ready()
    expect(toggle()).not.toBeInTheDocument()
    unmount()
    renderPage({ user: REX, roles: ['re'] })
    await ready()
    expect(toggle()).toBeInTheDocument()
  })

  it("keeps the form's own inputs disabled in edit mode: a field changes only through its pencil", async () => {
    const user = userEvent.setup()
    renderPage()
    await turnOnEditMode(user)
    expect(screen.getByDisplayValue('Poured curb')).toBeDisabled()
    expect(screen.getByDisplayValue('CAT 420')).toBeDisabled()
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Editing a field
// ---------------------------------------------------------------------------

describe('report page in review — editing a field', () => {
  it('saves the description by its path and shows it as a redline with the reviewer\'s initials', async () => {
    const user = userEvent.setup()
    renderPage()
    await turnOnEditMode(user)
    await user.click(screen.getByRole('button', { name: 'Edit Description of Work' }))
    const input = screen.getByLabelText('New value for Description of Work')
    expect(input).toHaveValue('Poured curb')
    await user.type(input, ' and sidewalk')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(redlines()).toEqual([['Poured curb', 'Poured curb and sidewalkOE']]))
    expect(api.editIdrField).toHaveBeenCalledWith(IDR_ID, {
      reportId: REPORT_ID, fieldPath: 'description', newValue: 'Poured curb and sidewalk',
    })
    expect(screen.queryByDisplayValue('Poured curb')).not.toBeInTheDocument() // the redline stands in for the box
    expect(toggle()).toHaveTextContent('Edit mode: on') // still on for the next edit
  })

  it('edits a workforce count, an added trade by its position, and a checklist answer', async () => {
    const user = userEvent.setup()
    renderPage()
    await turnOnEditMode(user)

    await user.click(screen.getByRole('button', { name: 'Edit Foremen' }))
    await user.clear(screen.getByLabelText('New value for Foremen'))
    await user.type(screen.getByLabelText('New value for Foremen'), '3')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.editIdrField).toHaveBeenLastCalledWith(IDR_ID, {
      reportId: REPORT_ID, fieldPath: 'workforce.foremen', newValue: '3' }))

    await user.click(await screen.findByRole('button', { name: 'Edit Masons' }))
    await user.clear(screen.getByLabelText('New value for Masons'))
    await user.type(screen.getByLabelText('New value for Masons'), '4')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.editIdrField).toHaveBeenLastCalledWith(IDR_ID, {
      reportId: REPORT_ID, fieldPath: 'additionalWorkforce[0].count', newValue: '4' }))

    await user.click(await screen.findByRole('button', { name: 'Edit Plastic Barrels' }))
    await user.selectOptions(screen.getByLabelText('New value for Plastic Barrels'), 'N')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.editIdrField).toHaveBeenLastCalledWith(IDR_ID, {
      reportId: REPORT_ID, fieldPath: 'safetyChecks.plasticBarrels', newValue: 'N' }))

    await waitFor(() => expect(redlines()).toEqual([['2', '3OE'], ['3', '4OE'], ['Y', 'NOE']]))
  })

  it("stacks the RE's edit on the OE's when the same field is edited at Stage 2", async () => {
    const user = userEvent.setup()
    server = idrAt('stage2_review')
    server.reports[0].report_data.description = 'Poured curb and sidewalk'
    server.field_edits = [{ edit_id: 'edit-0', report_id: REPORT_ID, field_path: 'description', edit_type: 'field_change',
      old_value: 'Poured curb', new_value: 'Poured curb and sidewalk', editor_initials: 'OE', editor_name: 'Olive Engineer' }]
    renderPage({ user: REX, roles: ['re'] })
    await ready()
    expect(redlines()).toEqual([['Poured curb', 'Poured curb and sidewalkOE']]) // the OE's edit, before any change

    await user.click(toggle())
    await user.click(screen.getByRole('button', { name: 'Edit Description of Work' }))
    await user.type(screen.getByLabelText('New value for Description of Work'), ', 120 LF')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(redlines()).toEqual([
      ['Poured curb', 'Poured curb and sidewalkOE', 'Poured curb and sidewalk, 120 LFRR'],
    ]))
  })

  it('shows a refused edit under the input and keeps what was typed', async () => {
    api.editIdrField.mockRejectedValueOnce(Object.assign(new Error('This report has no field description'), { status: 400 }))
    const user = userEvent.setup()
    renderPage()
    await turnOnEditMode(user)
    await user.click(screen.getByRole('button', { name: 'Edit Description of Work' }))
    await user.type(screen.getByLabelText('New value for Description of Work'), '!')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This report has no field description')
    expect(screen.getByLabelText('New value for Description of Work')).toHaveValue('Poured curb!')
    expect(api.getIdr).toHaveBeenCalledTimes(1) // no reload: nothing changed
  })

  it('tells the reviewer someone else edited the field, and reloads, on a conflict', async () => {
    api.editIdrField.mockImplementationOnce(async () => {
      // the other reviewer's edit landed first
      server.reports[0].report_data.description = 'Poured curb on Main St.'
      server.field_edits.push({ edit_id: 'theirs', report_id: REPORT_ID, field_path: 'description', edit_type: 'field_change',
        old_value: 'Poured curb', new_value: 'Poured curb on Main St.', editor_initials: 'AA', editor_name: 'Ada Admin' })
      throw Object.assign(new Error('The IDR changed while you were editing; reload and try again'), { status: 409 })
    })
    const user = userEvent.setup()
    renderPage()
    await turnOnEditMode(user)
    await user.click(screen.getByRole('button', { name: 'Edit Description of Work' }))
    await user.type(screen.getByLabelText('New value for Description of Work'), ' today')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Someone else edited this field — reloading')).toBeInTheDocument()
    await waitFor(() => expect(redlines()).toEqual([['Poured curb', 'Poured curb on Main St.AA']]))
    expect(api.getIdr).toHaveBeenCalledTimes(2)
    expect(screen.queryByLabelText('New value for Description of Work')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Pay items
// ---------------------------------------------------------------------------

describe('report page in review — pay items', () => {
  it('shows the items as rows of text past draft, for a reader with no edit rights', async () => {
    renderPage({ user: TEST_USER, roles: ['inspector'] })
    await ready()
    expect(payRows()).toEqual([['pay-item-row', '60.00'], ['pay-item-row', '29.00']])
    expect(screen.queryByRole('button', { name: /add item/i })).not.toBeInTheDocument()
  })

  it('revises a quantity by the item\'s id and draws the row pair', async () => {
    const user = userEvent.setup()
    renderPage()
    await turnOnEditMode(user)
    await user.click(screen.getByRole('button', { name: 'Revise the quantity of pay item 2' }))
    await user.type(screen.getByLabelText('New quantity'), '31.5')
    await user.click(screen.getByRole('button', { name: 'Revise' }))

    await waitFor(() => expect(payRows()).toEqual([
      ['pay-item-row', '60.00'], ['pay-item-row', '29.00'], ['pay-item-revision', '31.5OE'],
    ]))
    expect(api.revisePayItem).toHaveBeenCalledWith(IDR_ID, 'item-2', '31.5')
    expect(screen.getByText('29.00')).toHaveClass('line-through')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('adds a pay item to this report and shows it in blue with the adder\'s initials', async () => {
    const user = userEvent.setup()
    renderPage()
    await turnOnEditMode(user)
    await user.click(screen.getByRole('button', { name: 'Add Pay Item' }))
    await user.selectOptions(screen.getByLabelText('Item'), 'Enter manually')
    await user.type(screen.getByLabelText('Item No.'), '9.99')
    await user.type(screen.getByLabelText('Description'), 'Extra work')
    await user.type(screen.getByLabelText('Quantity'), '4')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(payRows()).toEqual([
      ['pay-item-row', '60.00'], ['pay-item-row', '29.00'], ['pay-item-row', '4OE'],
    ]))
    expect(api.addPayItem).toHaveBeenCalledWith(IDR_ID, {
      reportId: REPORT_ID, itemNo: '9.99', budgetCode: '', quantity: '4', unit: '', description: 'Extra work',
    })
    expect(screen.getByText('9.99').closest('td')).toHaveClass('text-[#0070C0]')
  })

  it('reloads with the notice when a revision loses a race', async () => {
    api.revisePayItem.mockRejectedValueOnce(Object.assign(new Error('changed'), { status: 409 }))
    const user = userEvent.setup()
    renderPage()
    await turnOnEditMode(user)
    await user.click(screen.getByRole('button', { name: 'Revise the quantity of pay item 1' }))
    await user.type(screen.getByLabelText('New quantity'), '55')
    await user.click(screen.getByRole('button', { name: 'Revise' }))
    expect(await screen.findByText('Someone else edited this field — reloading')).toBeInTheDocument()
    await waitFor(() => expect(api.getIdr).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Reading the redlines: everyone, at every status
// ---------------------------------------------------------------------------

describe('report page — redlines for every reader', () => {
  const EDITED = () => {
    const idr = idrAt('approved', { re_reviewer_uuid: REX.uuid })
    idr.reports[0].report_data.description = 'Poured curb and sidewalk'
    idr.reports[0].report_data.payItems[0].payQuantity = '55.00'
    idr.field_edits = [
      { edit_id: 'e1', report_id: REPORT_ID, field_path: 'description', edit_type: 'field_change',
        old_value: 'Poured curb', new_value: 'Poured curb and sidewalk', editor_initials: 'OE', editor_name: 'Olive Engineer' },
      { edit_id: 'e2', report_id: REPORT_ID, field_path: 'payItems[item-1].payQuantity', edit_type: 'pay_item_revision',
        old_value: '60.00', new_value: '55.00', editor_initials: 'RR', editor_name: 'Rex Resident' },
      { edit_id: 'e3', report_id: 'another-report', field_path: 'comments', edit_type: 'field_change',
        old_value: '', new_value: 'not this report', editor_initials: 'OE', editor_name: 'Olive Engineer' },
    ]
    return idr
  }

  it.each([
    ['the inspector', TEST_USER, ['inspector']],
    ['a reviewer', OLIVE, ['oe', 're']],
    ['someone with no role on the project', TEST_USER, []],
  ])('shows an approved IDR\'s redlines to %s, read-only', async (_, user, roles) => {
    server = EDITED()
    renderPage({ user, roles })
    await ready()
    expect(redlines()).toEqual([['Poured curb', 'Poured curb and sidewalkOE']])
    expect(payRows()).toEqual([['pay-item-row', '60.00'], ['pay-item-revision', '55.00RR'], ['pay-item-row', '29.00']])
    expect(toggle()).not.toBeInTheDocument()
    expect(pencils()).toHaveLength(0)
    expect(screen.queryByText('not this report')).not.toBeInTheDocument()
  })

  it('shows them to someone who is not signed in to anything but the page (no user at all)', async () => {
    server = EDITED()
    vi.spyOn(AuthContext, 'useOptionalAuth').mockReturnValue(null)
    render(
      <MemoryRouter initialEntries={[REPORT_URL]}>
        <Routes><Route path="/project/:projectId/idr/:idrId/general/:reportId" element={<GeneralReportPage />} /></Routes>
      </MemoryRouter>
    )
    await ready()
    expect(redlines()).toHaveLength(1)
    expect(toggle()).not.toBeInTheDocument()
  })

  it("keeps a returned draft's inputs live for its inspector and reads the reviewer's edit under the field", async () => {
    server = EDITED()
    server.status = 'draft'
    server.return_reason = 'check the description'
    renderPage({ user: TEST_USER, roles: ['inspector'] })
    await ready()
    expect(screen.getByDisplayValue('Poured curb and sidewalk')).toBeEnabled() // the reviewer's value, in the form
    expect(redlines()).toEqual([['Poured curb', 'Poured curb and sidewalkOE']])
    expect(screen.getByRole('button', { name: /^Add Item/ })).toBeInTheDocument() // the draft's own pay-item table
    expect(toggle()).not.toBeInTheDocument()
  })

  it('notes "Inspector revised after return" when the saved value has moved on from the last edit', async () => {
    server = EDITED()
    server.status = 'submitted' // resubmitted after the inspector changed the description
    server.reports[0].report_data.description = 'Poured curb, sidewalk and ramp'
    renderPage({ user: TEST_USER, roles: ['inspector'] })
    await ready()
    expect(redlines()).toEqual([
      ['Poured curb', 'Poured curb and sidewalkOE', 'Poured curb, sidewalk and rampInspector revised after return'],
    ])
  })
})
