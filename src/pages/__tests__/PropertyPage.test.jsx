import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import PropertyPage, { DEMO_NOTE, LIVE_PIR_TOOLTIP, NOT_CONFIRMED_TEXT, NOT_COVERED, NO_PIR_TEXT } from '../PropertyPage'
import { PIR_TAKEN } from '../../components/PirFormModal'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { DEMO_USER, TEST_USER } from '../../test/users'
import { SKETCH_TOO_LARGE_MESSAGE } from '../../services/constructionReport'

// ---------------------------------------------------------------------------
// Shared mocks: a tiny in-memory "server" of one property and its PIRs. Like the backend, a property takes one
// live PIR, a deleted one frees it, and listing them gives the newest first.
// ---------------------------------------------------------------------------

const ADMIN = { ...TEST_USER, role: 'admin', first_name: 'Ada', last_name: 'Admin' }
const RE = { uuid: 'f0000000-0000-4000-8000-000000000002', first_name: 'Rita', last_name: 'Engineer', email: 're@x' }
const PROPERTY_ID = 'c0000000-0000-4000-8000-000000000001'
const YEAR = new Date().getFullYear()

vi.mock('../../services/api', () => ({
  getProperty: vi.fn(), updateProperty: vi.fn(), softDeleteProperty: vi.fn(), undeleteProperty: vi.fn(),
  listPirs: vi.fn(), createPir: vi.fn(), updatePir: vi.fn(), softDeletePir: vi.fn(), undeletePir: vi.fn(),
  listAdminUsers: vi.fn(), listUsers: vi.fn(),
  listPirPages: vi.fn(),
  listFlags: vi.fn(), downloadConstructionReport: vi.fn(),
  listCorners: vi.fn(), getRampAttributes: vi.fn(), saveRampAttributes: vi.fn(), saveRampLabel: vi.fn(),
  getPropertyWorkHistory: vi.fn(), refreshTaxMap: vi.fn(), getTaxMapPdf: vi.fn(), refreshTaxMapPdf: vi.fn(),
  uploadTaxMapPdf: vi.fn(),
}))
vi.mock('../../components/SitePayItemsPanel', () => ({
  default: (props) => <div data-testid="site-pay-items" data-property={props.propertyId} />,
}))

const pir = (number, extra = {}) => ({
  id: `e0000000-0000-4000-8000-00000000000${number}`, property_id: PROPERTY_ID, project_id: 'HWS0023',
  inspector_initials: 'JD', inspector_sign_date: `${YEAR}-09-14`, digitized_by: ADMIN.uuid,
  digitized_at: `${YEAR}-09-20T12:00:00`, as_built_signed_by: null, as_built_signed_at: null,
  created_at: `${YEAR}-09-20T12:00:00`, deleted_at: null, deleted_by: null, ...extra,
})
const conflict = () => Object.assign(new Error('This property already has a PIR'), { status: 409, body: { existing_pir_id: 'x' } })

let property
let pirs
let created

const live = () => pirs.find(row => !row.deleted_at)

beforeEach(() => {
  vi.clearAllMocks()
  created = 0
  api.getPropertyWorkHistory.mockResolvedValue([])
  property = { id: PROPERTY_ID, project_id: 'HWS0023', kind: 'sidewalk', boro: 'Queens', block: '123', lot: '45',
    address: '12 Main St', display_address: '12 Main St', property_type: '4_plus_family', violation_no: 'V-77',
    notes: 'Corner lot', created_at: `${YEAR}-09-01T12:00:00`, deleted_at: null }
  pirs = []
  // The live PIR's flags, for the Construction Report button: none claimed unless a test says otherwise
  api.listFlags.mockResolvedValue([])
  // A ped ramp's corners and attributes: none unless a test says otherwise
  api.listCorners.mockResolvedValue([])
  api.getRampAttributes.mockResolvedValue(null)
  api.listAdminUsers.mockResolvedValue([ADMIN, RE])
  api.listUsers.mockResolvedValue([ADMIN, RE].map(({ uuid, ...rest }) => ({ user_id: uuid, ...rest })))
  api.getProperty.mockImplementation(async () => structuredClone(property))
  api.updateProperty.mockImplementation(async (id, values) => {
    property = { ...property, ...values }
    property.display_address = property.address
    return structuredClone(property)
  })
  api.softDeleteProperty.mockImplementation(async () => {
    property = { ...property, deleted_at: `${YEAR}-10-02T09:00:00` }
    return structuredClone(property)
  })
  api.undeleteProperty.mockImplementation(async () => {
    property = { ...property, deleted_at: null }
    return structuredClone(property)
  })
  api.listPirs.mockImplementation(async () => structuredClone(pirs))
  api.listPirPages.mockResolvedValue([{ pir_page_id: 'p1', page_number: 1 }, { pir_page_id: 'p2', page_number: 2 }, { pir_page_id: 'p3', page_number: 3 }])
  api.createPir.mockImplementation(async (id, values) => {
    if (live()) throw conflict()
    created += 1
    const row = pir(5 + created, values)
    pirs = [row, ...pirs]
    return row
  })
  api.updatePir.mockImplementation(async (id, values) => {
    pirs = pirs.map(row => (row.id === id ? { ...row, ...values } : row))
    return pirs.find(row => row.id === id)
  })
  api.softDeletePir.mockImplementation(async (id) => {
    pirs = pirs.map(row => (row.id === id ? { ...row, deleted_at: `${YEAR}-10-03T09:00:00` } : row))
    return pirs.find(row => row.id === id)
  })
  api.undeletePir.mockImplementation(async (id) => {
    if (live()) throw Object.assign(new Error('This property now has another PIR'), { status: 409 })
    pirs = pirs.map(row => (row.id === id ? { ...row, deleted_at: null } : row))
    return pirs.find(row => row.id === id)
  })
})

function CurrentUrl() {
  const location = useLocation()
  return (
    <>
      <div data-testid="url">{location.pathname}</div>
      <div data-testid="search">{location.search}</div>
    </>
  )
}

function renderPage(user = ADMIN, search = '') {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user })
  return render(
    <MemoryRouter initialEntries={[`/project/HWS0023/properties/${PROPERTY_ID}${search}`]}>
      <Routes>
        <Route path="/project/:projectId/properties/:propertyId" element={<PropertyPage />} />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
}

async function renderLoaded(user, search) {
  renderPage(user, search)
  await screen.findByRole('heading', { name: /HWS0023 · 12 Main St/ })
}

const REPORT_URL = '/project/HWS0023/idr/idr-1/swcb/rep-1'
const RETURN_TO = `?returnTo=${encodeURIComponent(REPORT_URL)}`

const propertyCard = () => screen.getByRole('region', { name: 'Site' })
const pirCard = () => screen.getByRole('region', { name: /^PIR/ })
const valueOf = (card, term) => within(card).getByText(term).nextSibling
const dialog = () => screen.getByRole('dialog')

async function addPir(initials = 'JD', date = `${YEAR}-09-14`) {
  await userEvent.click(within(pirCard()).getByRole('button', { name: 'Add PIR' }))
  await userEvent.type(screen.getByLabelText('Inspector initials'), initials)
  await userEvent.type(screen.getByLabelText('Inspector sign date'), date)
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
}

describe('PropertyPage — who can do what', () => {
  it("lets a project member who isn't an admin edit the site and add and edit its PIR, but not delete", async () => {
    await renderLoaded(TEST_USER)
    expect(within(propertyCard()).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(within(propertyCard()).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()

    await addPir('JD')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.createPir).toHaveBeenCalled()
    expect(within(pirCard()).getByRole('button', { name: 'Edit PIR' })).toBeInTheDocument()
    expect(within(pirCard()).queryByRole('button', { name: 'Delete PIR' })).not.toBeInTheDocument()
    // The member's name list is GET /v1/users/, not the admin's
    await waitFor(() => expect(valueOf(pirCard(), 'Digitized')).toHaveTextContent('by Ada Admin'))
    expect(api.listAdminUsers).not.toHaveBeenCalled()
  })

  it("doesn't show a member the property's deleted PIRs or Un-delete", async () => {
    pirs = [pir(1, { deleted_at: `${YEAR}-10-03T09:00:00` })] // the backend leaves these out for a member anyway
    await renderLoaded(TEST_USER)
    expect(within(pirCard()).queryByText('Deleted PIRs')).not.toBeInTheDocument()
    expect(within(pirCard()).queryByRole('button', { name: 'Un-delete' })).not.toBeInTheDocument()
  })

  it('gives a member a deleted property, and its live PIR, with nothing to change', async () => {
    property = { ...property, deleted_at: `${YEAR}-10-02T09:00:00` }
    pirs = [pir(1)]
    await renderLoaded(TEST_USER)
    // nothing to change: the one button is the Construction Report's download, which only reads
    expect(within(propertyCard()).getAllByRole('button').map(b => b.textContent)).toEqual(['Download Construction Report'])
    expect(within(pirCard()).getAllByRole('button').map(b => b.textContent)).toEqual(['Open sketch workspace'])
  })

  it("lets an admin edit a deleted property's live PIR, to clean up", async () => {
    property = { ...property, deleted_at: `${YEAR}-10-02T09:00:00` }
    pirs = [pir(1)]
    await renderLoaded()
    expect(within(propertyCard()).getByRole('button', { name: 'Un-delete' })).toBeInTheDocument()
    expect(within(pirCard()).getByRole('button', { name: 'Edit PIR' })).toBeInTheDocument()
  })

  it('gives a demo user the page read-only, with a note saying so', async () => {
    pirs = [pir(1)]
    await renderLoaded(DEMO_USER)
    expect(screen.getByText(DEMO_NOTE)).toBeInTheDocument()
    // nothing to change: the one button is the Construction Report's download, which only reads
    expect(within(propertyCard()).getAllByRole('button').map(b => b.textContent)).toEqual(['Download Construction Report'])
    expect(within(pirCard()).getAllByRole('button').map(b => b.textContent)).toEqual(['Open sketch workspace'])
  })

  it('gives a demo user no Add PIR either', async () => {
    await renderLoaded(DEMO_USER)
    expect(within(pirCard()).getByText(NO_PIR_TEXT)).toBeInTheDocument()
    expect(within(pirCard()).queryByRole('button', { name: 'Add PIR' })).not.toBeInTheDocument()
  })

  it("shows the backend's refusal of someone not on the project as the load error", async () => {
    api.getProperty.mockRejectedValueOnce(Object.assign(new Error('Project access required'), { status: 403 }))
    renderPage(TEST_USER)
    expect(await screen.findByText("Couldn't load the site: Project access required")).toBeInTheDocument()
  })
})

describe('PropertyPage — the property', () => {
  it("heads the page with the project and address, and lists a sidewalk's borough, block, lot, address, violation, type, notes and added", async () => {
    await renderLoaded()
    expect(api.getProperty).toHaveBeenCalledWith(PROPERTY_ID)
    expect(api.listPirs).toHaveBeenCalledWith(PROPERTY_ID, { includeDeleted: true })
    expect(valueOf(propertyCard(), 'Borough')).toHaveTextContent('Queens')
    expect(valueOf(propertyCard(), 'Block')).toHaveTextContent('123')
    expect(valueOf(propertyCard(), 'Lot')).toHaveTextContent('45')
    expect(within(propertyCard()).queryByText('BBL')).not.toBeInTheDocument()
    expect(valueOf(propertyCard(), 'Violation No.')).toHaveTextContent('V-77')
    expect(valueOf(propertyCard(), 'Address')).toHaveTextContent('12 Main St')
    expect(valueOf(propertyCard(), 'Type')).toHaveTextContent('4+ family / commercial')
    expect(valueOf(propertyCard(), 'Notes')).toHaveTextContent('Corner lot')
    expect(valueOf(propertyCard(), 'Added')).toHaveTextContent('Sep 1')
  })

  it("heads a ped ramp's page with its intersection, and lists its quadrant, the street it faces and its type", async () => {
    property = {
      ...property, kind: 'ped_ramp', boro: 'Brooklyn', block: null, lot: null, address: null, property_type: null, violation_no: null,
      intersection_street_1: 'Atlantic Ave', intersection_street_2: 'Court St', quadrant: 'NE', facing_street: 'street_2',
      ramp_type: 'CUT_THROUGH', display_address: 'Atlantic Ave & Court St — NE Quadrant (Facing Court St)',
    }
    renderPage()
    expect(await screen.findByRole('heading', { name: /HWS0023 · Atlantic Ave & Court St — NE Quadrant \(Facing Court St\)/ }))
      .toBeInTheDocument()
    expect(valueOf(propertyCard(), 'Borough')).toHaveTextContent('Brooklyn')
    expect(valueOf(propertyCard(), 'Intersection')).toHaveTextContent('Atlantic Ave & Court St')
    expect(valueOf(propertyCard(), 'Quadrant')).toHaveTextContent('NE')
    expect(valueOf(propertyCard(), 'Facing')).toHaveTextContent('Court St')
    expect(valueOf(propertyCard(), 'Ramp type')).toHaveTextContent('Cut-through')
    expect(within(propertyCard()).queryByText('Block')).not.toBeInTheDocument()
    expect(valueOf(propertyCard(), 'Inspection corner')).toHaveTextContent('—')
  })

  it("shows a ped ramp's inspection corner and its Ramp Attributes", async () => {
    const CORNER_ID = 'd0000000-0000-4000-8000-000000000001'
    api.listCorners.mockResolvedValue([{ corner_id: CORNER_ID, north_south_street: 'Court St',
      east_west_street: 'Atlantic Ave', corner_direction: 'NE', deleted_at: null, ramps: [] }])
    api.getRampAttributes.mockResolvedValue({ property_id: PROPERTY_ID, ramp_type: 'PERPENDICULAR', ramp_width_in: 30,
      warnings: [{ field: 'ramp_width_in', value: 30, limit: 'at least 36 in', message: 'Ramp width 30 in is less than 36 in' }] })
    property = {
      ...property, kind: 'ped_ramp', boro: 'Brooklyn', block: null, lot: null, address: null, property_type: null, violation_no: null,
      intersection_street_1: 'Atlantic Ave', intersection_street_2: 'Court St', quadrant: 'NE', facing_street: 'street_2',
      ramp_type: 'PERPENDICULAR', corner_id: CORNER_ID, display_address: 'Atlantic Ave & Court St — NE Quadrant (Facing Court St)',
    }
    renderPage()
    expect(await screen.findByText('Ramp width 30 in is less than 36 in')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Ramp Attributes/ })).toBeInTheDocument()
    await waitFor(() => expect(valueOf(propertyCard(), 'Inspection corner')).toHaveTextContent('Court St & Atlantic Ave (NE)'))
    expect(api.listCorners).toHaveBeenCalledWith('HWS0023')
    expect(api.getRampAttributes).toHaveBeenCalledWith(PROPERTY_ID)
  })

  it("edits a ped ramp at a corner in the Pedramp dialog, its corner locked, and asks before a type switch drops measurements", async () => {
    const CORNER_ID = 'd0000000-0000-4000-8000-000000000001'
    api.listCorners.mockResolvedValue([{ corner_id: CORNER_ID, boro: 'Brooklyn', north_south_street: 'Atlantic Ave',
      east_west_street: 'Court St', corner_direction: 'NE', deleted_at: null,
      ramps: [{ property_id: PROPERTY_ID, ramp_type: 'PERPENDICULAR', ramp_id_label: 'R1' }] }])
    api.getRampAttributes.mockResolvedValue({ property_id: PROPERTY_ID, ramp_type: 'PERPENDICULAR', ramp_width_in: 40,
      landing_length_in: 48, ramp_running_slope_pct: null, gutter_cross_slope_pct: 1.5, warnings: [] })
    property = {
      ...property, kind: 'ped_ramp', boro: 'Brooklyn', block: null, lot: null, address: null, property_type: null, violation_no: null,
      intersection_street_1: 'Atlantic Ave', intersection_street_2: 'Court St', quadrant: 'NE', facing_street: 'street_2',
      ramp_type: 'PERPENDICULAR', corner_id: CORNER_ID, display_address: 'Atlantic Ave & Court St — NE Quadrant (Facing Court St)',
    }
    renderPage()
    await waitFor(() => expect(valueOf(propertyCard(), 'Inspection corner')).toHaveTextContent('Atlantic Ave & Court St (NE)'))
    await userEvent.click(within(propertyCard().closest('main') ?? document.body).getByRole('button', { name: 'Edit' }))

    expect(dialog()).toHaveAccessibleName('Edit Pedramp')
    expect(within(dialog()).getByText("Sections A to C are this corner's: edit them from Site Info.")).toBeInTheDocument()
    const location = within(dialog()).getByRole('button', { name: 'A. Location & Corner' })
    expect(location).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(location)
    expect(within(dialog()).getByLabelText('North-south street')).toBeDisabled()
    expect(within(dialog()).getByLabelText(/Ramp ID/)).toHaveDisplayValue('R1')
    await waitFor(() => expect(api.getRampAttributes).toHaveBeenCalledTimes(2)) // the section's read and the dialog's

    // Parallel takes neither a ramp width nor a landing length; the gutter slope stays, and an empty slope isn't listed
    await userEvent.selectOptions(within(screen.getByRole('dialog', { name: 'Edit Pedramp' })).getByLabelText('Ramp type'), 'PARALLEL')
    const ask = await screen.findByRole('dialog', { name: 'Change the ramp type?' })
    expect(ask).toHaveTextContent('Switching from Perpendicular to Parallel will drop these measurements:')
    expect(within(ask).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Ramp width', 'Landing length'])
    await userEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    expect(within(screen.getByRole('dialog', { name: 'Edit Pedramp' })).getByLabelText('Ramp type')).toHaveDisplayValue('Perpendicular')
    expect(screen.getByRole('dialog', { name: 'Edit Pedramp' })).toBeInTheDocument()

    await userEvent.selectOptions(within(screen.getByRole('dialog', { name: 'Edit Pedramp' })).getByLabelText('Ramp type'), 'PARALLEL')
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Change the ramp type?' })).getByRole('button', { name: 'Continue' }))
    expect(within(screen.getByRole('dialog', { name: 'Edit Pedramp' })).getByLabelText('Ramp type')).toHaveDisplayValue('Parallel')
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Edit Pedramp' })).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.updateProperty).toHaveBeenCalledWith(PROPERTY_ID, { ramp_type: 'PARALLEL' })
    expect(api.saveRampLabel).not.toHaveBeenCalled()
  })

  it('reads no corners or attributes for a sidewalk', async () => {
    await renderLoaded()
    expect(screen.queryByRole('heading', { name: /Ramp Attributes/ })).not.toBeInTheDocument()
    expect(api.listCorners).not.toHaveBeenCalled()
    expect(api.getRampAttributes).not.toHaveBeenCalled()
  })

  it('goes back to the project\'s properties', async () => {
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Back to Site Info — HWS0023' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/project/HWS0023/properties')
  })

  it('shows the site\'s community board under CB', async () => {
    property = { ...property, community_board: 'QN13' }
    await renderLoaded()
    expect(valueOf(propertyCard(), 'CB')).toHaveTextContent('QN13')
  })

  it('reads a dash for a site without a community board', async () => {
    await renderLoaded()
    expect(valueOf(propertyCard(), 'CB')).toHaveTextContent('—')
  })

  it('goes back to the task order the site is in', async () => {
    property = { ...property, task_order_id: 'd0000000-0000-4000-8000-000000000001', task_order_no: 'TO-001' }
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Back to task order TO-001' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/project/HWS0023/task-orders/d0000000-0000-4000-8000-000000000001')
  })

  it('greys out Back to task order for a site in no task order', async () => {
    property = { ...property, task_order_id: null, task_order_no: null }
    await renderLoaded()
    const button = screen.getByRole('button', { name: 'Back to task order' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Not in a task order')
  })

  it('keeps Back to task order after an edit, whose answer has no task order', async () => {
    property = { ...property, task_order_id: 'd0000000-0000-4000-8000-000000000001', task_order_no: 'TO-001' }
    api.updateProperty.mockImplementationOnce(async (id, values) => {
      const { task_order_id, task_order_no, ...rest } = { ...property, ...values }
      return rest
    })
    await renderLoaded()
    await userEvent.click(within(propertyCard()).getByRole('button', { name: 'Edit' }))
    await userEvent.clear(screen.getByLabelText('Address'))
    await userEvent.type(screen.getByLabelText('Address'), '14 Main St')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Back to task order TO-001' })).toBeEnabled()
  })

  it('shows a load failure with Retry', async () => {
    api.getProperty.mockRejectedValueOnce(new Error('Property not found'))
    renderPage()
    expect(await screen.findByText("Couldn't load the site: Property not found")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: /12 Main St/ })).toBeInTheDocument()
  })

  it('edits the property in its pre-filled dialog', async () => {
    await renderLoaded()
    await userEvent.click(within(propertyCard()).getByRole('button', { name: 'Edit' }))
    expect(dialog()).toHaveAccessibleName('Edit sidewalk')
    expect(within(dialog()).getByText('Site type: Sidewalk')).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Address'))
    await userEvent.type(screen.getByLabelText('Address'), '14 Main St')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.updateProperty).toHaveBeenCalledWith(PROPERTY_ID, { address: '14 Main St' })
    expect(screen.getByRole('heading', { name: /HWS0023 · 14 Main St/ })).toBeInTheDocument()
  })

  it('deletes the property once confirmed, then offers Un-delete and no new PIR', async () => {
    await renderLoaded()
    await userEvent.click(within(propertyCard()).getByRole('button', { name: 'Delete' }))
    expect(dialog()).toHaveAccessibleName('Delete site Queens Block 123 Lot 45?')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Site Queens Block 123 Lot 45 deleted.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /12 Main St/ })).toHaveTextContent('Deleted')
    expect(within(pirCard()).queryByRole('button', { name: 'Add PIR' })).not.toBeInTheDocument()

    await userEvent.click(within(propertyCard()).getByRole('button', { name: 'Un-delete' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Un-delete' }))
    expect(await within(pirCard()).findByRole('button', { name: 'Add PIR' })).toBeInTheDocument()
  })
})

describe('PropertyPage — the way into the sketch workspace', () => {
  it('offers no Back to report without a returnTo', async () => {
    await renderLoaded()
    expect(screen.queryByRole('button', { name: 'Back to report' })).not.toBeInTheDocument()
  })

  it('goes back to the report it was opened from, keeping its own back buttons', async () => {
    await renderLoaded(ADMIN, RETURN_TO)
    expect(screen.getByRole('button', { name: 'Back to Site Info — HWS0023' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back to report' }))
    expect(screen.getByTestId('url')).toHaveTextContent(REPORT_URL)
  })

  it('ignores a returnTo outside the app', async () => {
    await renderLoaded(ADMIN, `?returnTo=${encodeURIComponent('//evil.example/project/x')}`)
    expect(screen.queryByRole('button', { name: 'Back to report' })).not.toBeInTheDocument()
  })

  it('carries returnTo into the sketch workspace', async () => {
    pirs = [pir(1)]
    await renderLoaded(ADMIN, RETURN_TO)
    await userEvent.click(within(pirCard()).getByRole('button', { name: 'Open sketch workspace' }))
    expect(screen.getByTestId('url')).toHaveTextContent(`/project/HWS0023/properties/${PROPERTY_ID}/pir`)
    expect(screen.getByTestId('search')).toHaveTextContent(RETURN_TO)
  })

  it("opens the PIR card with the page count and \"Open sketch workspace\", above the PIR's details", async () => {
    pirs = [pir(1)]
    await renderLoaded()
    expect(await within(pirCard()).findByText('3 pages')).toBeInTheDocument()
    expect(api.listPirPages).toHaveBeenCalledWith(pirs[0].id)
    const open = within(pirCard()).getByRole('button', { name: 'Open sketch workspace' })
    const details = within(pirCard()).getByText('Inspector initials')
    expect(open.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await userEvent.click(open)
    expect(screen.getByTestId('url')).toHaveTextContent(`/project/HWS0023/properties/${PROPERTY_ID}/pir`)
  })

  it('says when no pages are uploaded yet, and gives a demo user the way in too', async () => {
    pirs = [pir(1)]
    api.listPirPages.mockResolvedValue([])
    await renderLoaded(DEMO_USER)
    expect(await within(pirCard()).findByText('No pages uploaded yet')).toBeInTheDocument()
    expect(within(pirCard()).getByRole('button', { name: 'Open sketch workspace' })).toBeInTheDocument()
  })

  it("says so when the pages can't be read, the button still there", async () => {
    pirs = [pir(1)]
    api.listPirPages.mockRejectedValue(new Error('Storage is down'))
    await renderLoaded()
    expect(await within(pirCard()).findByText("Couldn't read the pages: Storage is down")).toBeInTheDocument()
    expect(within(pirCard()).getByRole('button', { name: 'Open sketch workspace' })).toBeInTheDocument()
  })

  it('has no way in without a live PIR', async () => {
    await renderLoaded()
    expect(within(pirCard()).queryByRole('button', { name: 'Open sketch workspace' })).not.toBeInTheDocument()
    expect(api.listPirPages).not.toHaveBeenCalled()
  })
})

describe('PropertyPage — the PIR', () => {
  it('reads "No PIR yet." with Add PIR and a dash for its status when there is none', async () => {
    await renderLoaded()
    expect(within(pirCard()).getByText(NO_PIR_TEXT)).toBeInTheDocument()
    expect(within(pirCard()).getByText('—')).toBeInTheDocument()
    expect(within(pirCard()).getByRole('button', { name: 'Add PIR' })).toBeInTheDocument()
  })

  it('adds a PIR, and the card shows it signed by DOT, digitized by the admin, as-built not confirmed', async () => {
    await renderLoaded()
    await addPir(' JD ')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(api.createPir).toHaveBeenCalledWith(PROPERTY_ID, { inspector_initials: 'JD', inspector_sign_date: `${YEAR}-09-14` })
    expect(within(pirCard()).getByText('Signed by DOT')).toBeInTheDocument()
    expect(valueOf(pirCard(), 'Inspector initials')).toHaveTextContent('JD')
    expect(valueOf(pirCard(), 'Signed on')).toHaveTextContent('Sep 14')
    expect(valueOf(pirCard(), 'Digitized')).toHaveTextContent('Sep 20 by Ada Admin')
    expect(valueOf(pirCard(), 'As-built')).toHaveTextContent(NOT_CONFIRMED_TEXT)
  })

  it('shows a signed as-built with its signer and date', async () => {
    pirs = [pir(1, { as_built_signed_by: RE.uuid, as_built_signed_at: `${YEAR}-10-05T15:00:00` })]
    await renderLoaded()
    expect(within(pirCard()).getByText('As-built signed', { selector: 'span' })).toBeInTheDocument()
    await waitFor(() => expect(valueOf(pirCard(), 'As-built')).toHaveTextContent('As-built signed by Rita Engineer on Oct 5'))
  })

  it('gives dates alone when the user list can\'t be read', async () => {
    api.listAdminUsers.mockRejectedValue(new Error('Failed to fetch users'))
    pirs = [pir(1)]
    await renderLoaded()
    await waitFor(() => expect(api.listAdminUsers).toHaveBeenCalled())
    expect(valueOf(pirCard(), 'Digitized')).toHaveTextContent(/^Sep 20$/)
  })

  it('edits the PIR, sending only what changed', async () => {
    pirs = [pir(1)]
    await renderLoaded()
    await userEvent.click(within(pirCard()).getByRole('button', { name: 'Edit PIR' }))
    expect(dialog()).toHaveAccessibleName('Edit PIR')
    expect(screen.getByLabelText('Inspector initials')).toHaveDisplayValue('JD')
    await userEvent.clear(screen.getByLabelText('Inspector initials'))
    await userEvent.type(screen.getByLabelText('Inspector initials'), 'JQD')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.updatePir).toHaveBeenCalledWith(pirs[0].id, { inspector_initials: 'JQD' })
    expect(valueOf(pirCard(), 'Inspector initials')).toHaveTextContent('JQD')
  })

  it('deletes the PIR once confirmed: the card goes back to "No PIR yet." and lists it as deleted', async () => {
    pirs = [pir(1)]
    await renderLoaded()
    await userEvent.click(within(pirCard()).getByRole('button', { name: 'Delete PIR' }))
    expect(dialog()).toHaveAccessibleName('Delete this PIR?')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('PIR deleted.')).toBeInTheDocument()
    expect(within(pirCard()).getByText(NO_PIR_TEXT)).toBeInTheDocument()
    const deletedRow = within(pirCard()).getByText(/JD, signed Sep 14/).closest('li')
    expect(deletedRow).toHaveAttribute('data-deleted', 'true')
    expect(deletedRow).toHaveClass('text-gray-400')
  })

  it('un-deletes a deleted PIR once confirmed', async () => {
    pirs = [pir(1, { deleted_at: `${YEAR}-10-03T09:00:00` })]
    await renderLoaded()
    await userEvent.click(within(pirCard()).getByRole('button', { name: 'Un-delete' }))
    expect(dialog()).toHaveAccessibleName('Un-delete this PIR?')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Un-delete' }))

    expect(await screen.findByText('PIR restored.')).toBeInTheDocument()
    expect(api.undeletePir).toHaveBeenCalledWith(pirs[0].id)
    expect(within(pirCard()).getByText('Signed by DOT')).toBeInTheDocument()
    expect(within(pirCard()).queryByText('Deleted PIRs')).not.toBeInTheDocument()
  })

  it('takes a new PIR after one was deleted, and keeps the deleted one listed with Un-delete off', async () => {
    pirs = [pir(1, { inspector_initials: 'OLD', deleted_at: `${YEAR}-10-03T09:00:00` })]
    await renderLoaded()
    await addPir('NEW')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(valueOf(pirCard(), 'Inspector initials')).toHaveTextContent('NEW')
    const undelete = within(pirCard()).getByRole('button', { name: 'Un-delete' })
    expect(undelete).toBeDisabled()
    expect(undelete).toHaveAttribute('title', LIVE_PIR_TOOLTIP)
  })

  it('shows a 409 in the create dialog when the property got a PIR meanwhile, and reveals it on Cancel', async () => {
    await renderLoaded()
    pirs = [pir(1, { inspector_initials: 'XY' })] // another admin added one after the page loaded
    await addPir('JD')

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(PIR_TAKEN)
    expect(screen.getByLabelText('Inspector initials')).toHaveDisplayValue('JD')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(valueOf(pirCard(), 'Inspector initials')).toHaveTextContent('XY'))
  })

  it('shows a refused un-delete in its dialog', async () => {
    pirs = [pir(1, { deleted_at: `${YEAR}-10-03T09:00:00` })]
    await renderLoaded()
    api.undeletePir.mockRejectedValueOnce(Object.assign(new Error('This property now has another PIR'), { status: 409 }))
    await userEvent.click(within(pirCard()).getByRole('button', { name: 'Un-delete' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Un-delete' }))
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('This property now has another PIR')
  })
})

// ---------------------------------------------------------------------------
// The Construction Report (R1h)
// ---------------------------------------------------------------------------

describe('PropertyPage — Construction Report', () => {
  const reportButton = () => within(propertyCard()).getByRole('button', { name: 'Download Construction Report' })

  it('is on once an approved IDR has claimed one of the live PIR\'s flags', async () => {
    pirs = [pir(1)]
    api.listFlags.mockResolvedValue([{ id: 'f1', claimed_by_idr_id: null }, { id: 'f2', claimed_by_idr_id: 'idr-1' }])
    await renderLoaded()
    await waitFor(() => expect(reportButton()).toBeEnabled())
    expect(api.listFlags).toHaveBeenCalledWith(pirs[0].id)
  })

  it('is off, saying why, while no flag is claimed', async () => {
    pirs = [pir(1)]
    api.listFlags.mockResolvedValue([{ id: 'f1', claimed_by_idr_id: null }])
    await renderLoaded()
    await waitFor(() => expect(reportButton()).toHaveAttribute('title', NOT_COVERED))
    expect(reportButton()).toBeDisabled()
  })

  it('is off without a live PIR, and reads no flags', async () => {
    await renderLoaded()
    expect(reportButton()).toBeDisabled()
    expect(api.listFlags).not.toHaveBeenCalled()
  })

  it('stays on when the flags can\'t be read, so the backend can say why', async () => {
    pirs = [pir(1)]
    api.listFlags.mockRejectedValue(new Error('Network down'))
    await renderLoaded()
    await waitFor(() => expect(reportButton()).toBeEnabled())
  })

  it('downloads the property\'s report on click', async () => {
    pirs = [pir(1)]
    api.listFlags.mockResolvedValue([{ id: 'f1', claimed_by_idr_id: 'idr-1' }])
    api.downloadConstructionReport.mockResolvedValue('12_Main_St_construction_report.pdf')
    await renderLoaded()
    await waitFor(() => expect(reportButton()).toBeEnabled())
    await userEvent.click(reportButton())
    expect(api.downloadConstructionReport).toHaveBeenCalledWith(PROPERTY_ID)
  })

  it('shows the sketch-too-large refusal in the backend\'s words', async () => {
    pirs = [pir(1)]
    api.listFlags.mockResolvedValue([{ id: 'f1', claimed_by_idr_id: 'idr-1' }])
    api.downloadConstructionReport.mockRejectedValue(Object.assign(new Error(SKETCH_TOO_LARGE_MESSAGE), { status: 422 }))
    await renderLoaded()
    await waitFor(() => expect(reportButton()).toBeEnabled())
    await userEvent.click(reportButton())
    expect(await within(propertyCard()).findByRole('alert')).toHaveTextContent(SKETCH_TOO_LARGE_MESSAGE)
  })

  it('is there for a demo user too, who can download it', async () => {
    pirs = [pir(1)]
    api.listFlags.mockResolvedValue([{ id: 'f1', claimed_by_idr_id: 'idr-1' }])
    await renderLoaded(DEMO_USER)
    await waitFor(() => expect(reportButton()).toBeEnabled())
  })
})

describe('PropertyPage — Work history', () => {
  const entry = (extra) => ({
    id: `s-${extra.idr_number ?? 'x'}`, idr_id: 'idr-1', report_id: 'r-1', report_type: 'SWCB', work_type: 'excavation',
    work_type_other: null, added_at: '2026-10-19T13:00:00Z', idr_number: '123AB', report_date: '2026-10-19',
    status: 'approved', deleted_at: null, return_reason: null, reporter_uuid: 'u-1', reporter_name: 'Genghis Khan', ...extra,
  })

  it('lists every import, newest first, deleted ones struck and returned ones marked', async () => {
    api.getPropertyWorkHistory.mockResolvedValue([
      entry({ id: 'a', work_type: 'other', work_type_other: 'Custom work spec', idr_number: 'IDR-013', report_date: '2026-10-27',
        reporter_name: 'Alice Admin', status: 'deleted', deleted_at: '2026-10-28T13:00:00Z' }),
      entry({ id: 'b', work_type: 'pavement_restoration', idr_number: null, report_date: '2026-10-26', reporter_name: 'John Smith',
        status: 'draft', return_reason: 'Fix it' }),
      entry({ id: 'c', work_type: 'concrete', idr_number: 'IDR-005', report_date: '2026-10-20', reporter_name: 'Jane Doe' }),
      entry({ id: 'd' }),
    ])
    renderPage()
    const section = await screen.findByRole('region', { name: 'Work history' })
    const items = await within(section).findAllByRole('listitem')
    expect(items.map(item => item.textContent)).toEqual([
      '"Custom work spec" on 10/27/26 reported by Alice Admin, IDR# IDR-013(deleted)',
      'Pavement Restoration on 10/26/26 reported by John Smith, IDR# Draft(returned)',
      'Concrete on 10/20/26 reported by Jane Doe, IDR# IDR-005',
      'Excavation on 10/19/26 reported by Genghis Khan, IDR# 123AB',
    ])
    expect(within(items[0]).getByText(/Custom work spec/)).toHaveClass('line-through')
    expect(api.getPropertyWorkHistory).toHaveBeenCalledWith(PROPERTY_ID)
  })

  it('says when no IDR has reported work here', async () => {
    renderPage()
    expect(await screen.findByText('No IDR has reported work here yet.')).toBeInTheDocument()
  })
})

describe("PropertyPage — a site's pay items for an IDR (W3)", () => {
  it('shows them on a ped ramp, under its attributes', async () => {
    api.getRampAttributes.mockResolvedValue({ property_id: PROPERTY_ID, ramp_type: 'PERPENDICULAR', warnings: [] })
    property = {
      ...property, kind: 'ped_ramp', boro: 'Brooklyn', block: null, lot: null, address: null, property_type: null, violation_no: null,
      intersection_street_1: 'Atlantic Ave', intersection_street_2: 'Court St', quadrant: 'NE', facing_street: 'street_2',
      ramp_type: 'PERPENDICULAR', corner_id: null, display_address: 'Atlantic Ave & Court St — NE Quadrant (Facing Court St)',
    }
    renderPage(ADMIN, '?idrId=idr-1&reportId=rep-1')
    expect(await screen.findByTestId('site-pay-items')).toHaveAttribute('data-property', PROPERTY_ID)
  })

  it("leaves them to a sidewalk's PIR workspace", async () => {
    await renderLoaded(ADMIN, '?idrId=idr-1&reportId=rep-1')
    expect(screen.queryByTestId('site-pay-items')).not.toBeInTheDocument()
  })
})

describe('PropertyPage: tax map frontage (Slice Y1)', () => {
  it('shows a sidewalk its MapPLUTO frontage', async () => {
    property = { ...property, tax_map_frontage_ft: 16.67, tax_map_source: 'mappluto_26v2', tax_map_fetched_at: '2026-11-05T14:00:00Z' }
    await renderLoaded(TEST_USER)
    expect(valueOf(propertyCard(), 'Tax map frontage')).toHaveTextContent('16.67 ft · MapPLUTO 26v2 · fetched 2026-11-05')
    expect(within(valueOf(propertyCard(), 'Tax map frontage')).queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
  })

  it('lets an admin refresh it, and says how many title blocks took it', async () => {
    api.refreshTaxMap.mockResolvedValue({ frontage_ft: 18.75, source: 'mappluto_26v2', fetched_at: '2026-11-06T10:00:00Z', pages_updated: 1 })
    await renderLoaded(ADMIN)
    expect(valueOf(propertyCard(), 'Tax map frontage')).toHaveTextContent('— · unavailable')
    await userEvent.click(within(valueOf(propertyCard(), 'Tax map frontage')).getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(valueOf(propertyCard(), 'Tax map frontage')).toHaveTextContent('18.75 ft · MapPLUTO 26v2 · fetched 2026-11-06'))
    expect(api.refreshTaxMap).toHaveBeenCalledWith(PROPERTY_ID)
    expect(screen.getByRole('status')).toHaveTextContent('Tax map frontage refreshed; 1 title block updated.')
  })

  it('shows a ped ramp none', async () => {
    property = { ...property, kind: 'ped_ramp', block: null, lot: null, address: null, property_type: null,
      intersection_street_1: 'Main St', intersection_street_2: '1st Ave', quadrant: 'NE', facing_street: 'street_2',
      ramp_type: 'PERPENDICULAR', display_address: '12 Main St' }
    await renderLoaded(ADMIN)
    expect(within(propertyCard()).queryByText('Tax map frontage')).not.toBeInTheDocument()
  })
})


describe('PropertyPage: tax map PDF (Slice Y1.5)', () => {
  it('reads none, and an admin refreshes it from DOF', async () => {
    api.refreshTaxMapPdf.mockResolvedValue({ source: 'dof_map_library', map_id: '30001230', effective_date: '2013-07-25',
      fetched_at: '2026-11-06T10:00:00Z', uploaded_by: null })
    await renderLoaded(ADMIN)
    expect(valueOf(propertyCard(), 'Tax map PDF')).toHaveTextContent('— · none')
    await userEvent.click(within(valueOf(propertyCard(), 'Tax map PDF')).getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(valueOf(propertyCard(), 'Tax map PDF')).toHaveTextContent('Queens block 123 · effective 2013-07-25'))
    expect(screen.getByRole('status')).toHaveTextContent('Tax map PDF refreshed from DOF.')
  })

  it("shows a member the site's map with no admin buttons", async () => {
    property = { ...property, has_tax_map_pdf: true, tax_map_pdf_source: 'dof_map_library', tax_map_pdf_map_id: '30001230',
      tax_map_pdf_effective_date: '2013-07-25' }
    await renderLoaded(TEST_USER)
    const line = valueOf(propertyCard(), 'Tax map PDF')
    expect(within(line).getByRole('link', { name: 'View' })).toBeInTheDocument()
    expect(within(line).queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument()
  })
})
