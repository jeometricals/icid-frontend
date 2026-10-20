import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import PropertiesPage, { DEMO_NOTE } from '../PropertiesPage'
import { PED_RAMP_HEADINGS } from '../../components/PedRampsSection'
import { BLOCK_LOT_TAKEN } from '../../components/PropertyFormModal'
import { BULK_UPLOAD_TOOLTIP } from '../../components/SiteSection'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

// ---------------------------------------------------------------------------
// Shared mocks: a tiny in-memory "server", so the list read after a change shows what the backend wrote
// ---------------------------------------------------------------------------

const ADMIN = { ...TEST_USER, role: 'admin' }
const YEAR = new Date().getFullYear()

const base = (number, extra) => ({
  id: `c0000000-0000-4000-8000-00000000000${number}`, project_id: 'HWS0023', notes: null,
  created_at: `${YEAR}-09-14T12:00:00`, updated_at: `${YEAR}-09-14T12:00:00`, created_by: ADMIN.uuid,
  deleted_at: null, deleted_by: null, pir_status: 'none', status: { state: 'none', date: null }, task_order_no: null,
  ...extra,
})
// What the backend works out from a sidewalk's or a ped ramp's fields
const withDisplay = (row) => {
  if (row.kind === 'ped_ramp') {
    const facing = row.facing_street === 'street_1' ? row.intersection_street_1 : row.intersection_street_2
    return { ...row, display_address: `${row.intersection_street_1} & ${row.intersection_street_2} — ${row.quadrant} Quadrant (Facing ${facing})` }
  }
  return { ...row, display_address: row.address }
}
const sidewalk = (number, [boro, block, lot], address, extra = {}) => withDisplay(base(number, {
  kind: 'sidewalk', boro, block, lot, address, property_type: '1_3_family', violation_no: null,
  intersection_street_1: null, intersection_street_2: null, quadrant: null, facing_street: null, ramp_type: null, ...extra,
}))
const pedRamp = (number, street1, street2, extra = {}) => withDisplay(base(number, {
  kind: 'ped_ramp', boro: 'Brooklyn', block: null, lot: null, address: null, property_type: null, violation_no: null,
  intersection_street_1: street1, intersection_street_2: street2, quadrant: 'NE', facing_street: 'street_2',
  ramp_type: 'PERPENDICULAR', ...extra,
}))
const CORNER_ID = 'd0000000-0000-4000-8000-000000000001'
const LISTED = [
  sidewalk(1, ['Queens', '123', '45'], '12 Main St', { violation_no: 'V-100', status: { state: 'task_ordered', date: null }, task_order_no: 'TO-7' }),
  sidewalk(2, ['Queens', '123', '99'], '40 Oak Ave', { property_type: '4_plus_family', status: { state: 'constructed_on', date: `${YEAR}-10-02` } }),
  pedRamp(3, 'Atlantic Ave', 'Court St', { corner_id: CORNER_ID }),
]
// The ped ramp's corner, as the backend stores it; its ramps are worked out from the server's sites
const CORNER = {
  corner_id: CORNER_ID, project_id: 'HWS0023', boro: 'Brooklyn', north_south_street: 'Atlantic Ave',
  east_west_street: 'Court St', corner_direction: 'NE', corner_number: '2', inspected_by: 'RG',
  inspection_date: `${YEAR}-10-19`, contractor_name: 'Acme', deleted_at: null,
}

vi.mock('../../services/api', () => ({
  listProperties: vi.fn(), createProperty: vi.fn(), updateProperty: vi.fn(),
  softDeleteProperty: vi.fn(), undeleteProperty: vi.fn(),
  listCorners: vi.fn(), updateCorner: vi.fn(), deleteCorner: vi.fn(), createPedrampSite: vi.fn(),
  saveRampLabel: vi.fn(), downloadInspectionReport: vi.fn(), getRampAttributes: vi.fn(async () => null),
}))

const conflict = () => Object.assign(new Error('A site at Queens Block 123 Lot 45 already exists in this project.'), {
  status: 409, body: { existing_property_id: 'x' },
})
const live = (row) => !row.deleted_at

let server
let corners
let labels // each ramp's Ramp ID, by its site's id

// A corner as the list reads it: with its live ramps
const withRamps = (corner) => ({
  ...corner,
  ramps: server.filter(row => live(row) && row.corner_id === corner.corner_id).map(row => ({
    property_id: row.id, ramp_type: row.ramp_type, quadrant: row.quadrant, ramp_id_label: labels[row.id] ?? null,
  })),
})

beforeEach(() => {
  vi.clearAllMocks()
  server = structuredClone(LISTED)
  corners = [structuredClone(CORNER)]
  labels = { [LISTED[2].id]: 'R1' }
  api.listCorners.mockImplementation(async (projectId, { includeDeleted = false } = {}) => (
    corners.filter(corner => includeDeleted || live(corner)).map(withRamps)
  ))
  api.createPedrampSite.mockImplementation(async (projectId, values) => {
    let corner = corners.find(found => live(found) && found.boro === values.boro &&
      found.north_south_street.toLowerCase() === values.north_south_street.toLowerCase() &&
      found.east_west_street.toLowerCase() === values.east_west_street.toLowerCase() &&
      found.corner_direction === values.corner_direction)
    const reused = Boolean(corner)
    if (!corner) {
      corner = { ...values, corner_id: `d0000000-0000-4000-8000-00000000000${corners.length + 1}`, project_id: projectId, deleted_at: null }
      corners = [...corners, corner]
    }
    const created = pedRamp(server.length + 1, corner.north_south_street, corner.east_west_street, {
      boro: corner.boro, quadrant: values.quadrant, facing_street: values.facing_street, ramp_type: values.ramp_type,
      notes: values.notes, corner_id: corner.corner_id,
    })
    server = [...server, created]
    if (values.ramp_id_label) labels[created.id] = values.ramp_id_label
    return { corner_id: corner.corner_id, property_id: created.id, corner_reused: reused }
  })
  api.updateCorner.mockImplementation(async (id, values) => {
    corners = corners.map(corner => (corner.corner_id === id ? { ...corner, ...values } : corner))
    const corner = corners.find(found => found.corner_id === id)
    server = server.map(row => (row.corner_id === id && live(row) ? withDisplay({
      ...row, boro: corner.boro, intersection_street_1: corner.north_south_street, intersection_street_2: corner.east_west_street,
    }) : row))
    return withRamps(corner)
  })
  api.saveRampLabel.mockImplementation(async (id, rampType, label) => {
    labels[id] = label
    return { property_id: id, ramp_id_label: label }
  })
  api.deleteCorner.mockImplementation(async (id) => {
    corners = corners.map(corner => (corner.corner_id === id ? { ...corner, deleted_at: `${YEAR}-10-19T09:00:00` } : corner))
    return corners.find(corner => corner.corner_id === id)
  })
  api.listProperties.mockImplementation(async (projectId, { includeDeleted = false } = {}) => (
    structuredClone(server.filter(row => includeDeleted || live(row)))
  ))
  api.createProperty.mockImplementation(async (projectId, { kind, ...values }) => {
    const at = row => [row.boro, row.block, row.lot].join('/')
    if (kind === 'sidewalk' && server.some(row => live(row) && row.kind === 'sidewalk' && at(row) === at(values))) throw conflict()
    const created = kind === 'ped_ramp'
      ? pedRamp(9, values.intersection_street_1, values.intersection_street_2, values)
      : sidewalk(9, [values.boro, values.block, values.lot], values.address, values)
    server = [...server, created]
    return created
  })
  api.updateProperty.mockImplementation(async (id, values) => {
    if (values.kind) throw Object.assign(new Error('Property kind cannot be changed. Delete and recreate.'), { status: 400 })
    server = server.map(row => (row.id === id ? withDisplay({ ...row, ...values }) : row))
    return server.find(row => row.id === id)
  })
  api.softDeleteProperty.mockImplementation(async (id) => {
    server = server.map(row => (row.id === id ? { ...row, deleted_at: `${YEAR}-10-01T09:00:00`, deleted_by: ADMIN.uuid } : row))
    return server.find(row => row.id === id)
  })
  api.undeleteProperty.mockImplementation(async (id) => {
    server = server.map(row => (row.id === id ? { ...row, deleted_at: null, deleted_by: null } : row))
    return server.find(row => row.id === id)
  })
})

function CurrentUrl() {
  return <div data-testid="url">{useLocation().pathname}</div>
}

function renderPage(user = ADMIN) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user })
  return render(
    <MemoryRouter initialEntries={['/project/HWS0023/properties']}>
      <Routes>
        <Route path="/project/:projectId/properties" element={<PropertiesPage />} />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
}

const sidewalks = () => screen.getByRole('region', { name: 'Prior Notice Violation Sidewalks' })
const ramps = () => screen.getByRole('region', { name: 'Pedestrian Ramps' })
const rowOf = (text) => screen.getByText(text).closest('tr')
const RAMP = 'Atlantic Ave & Court St' // the ped ramp's Intersection cell
const cornerRow = (id = CORNER_ID) => document.querySelector(`tr[data-corner="${id}"]`)
const queryRowOf = (text) => screen.queryByText(text)?.closest('tr') ?? null
const headings = (section) => within(section).getAllByRole('columnheader').map(th => th.textContent)
const dialog = () => screen.getByRole('dialog')
const showDeleted = () => screen.getByRole('checkbox', { name: 'Show deleted' })

async function renderListed(user) {
  renderPage(user)
  await screen.findAllByRole('table')
}

describe('PropertiesPage — the two sections', () => {
  it('lists sidewalks and ped ramps in their own sections, with their counts and columns', async () => {
    await renderListed()
    expect(screen.getByRole('heading', { name: 'Site Info — HWS0023' })).toBeInTheDocument()
    expect(api.listProperties).toHaveBeenCalledWith('HWS0023', { includeDeleted: false })
    expect(within(sidewalks()).getByRole('button', { name: 'Prior Notice Violation Sidewalks (2)' })).toBeInTheDocument()
    expect(within(ramps()).getByRole('button', { name: 'Pedestrian Ramps (1)' })).toBeInTheDocument()
    expect(headings(sidewalks())).toEqual(
      ['Borough', 'Block', 'Lot', 'CB', 'Address', 'Violation No.', 'Status', 'Added', 'Task Order No.', 'Actions'],
    )
    expect(headings(ramps())).toEqual(PED_RAMP_HEADINGS)
    expect(PED_RAMP_HEADINGS).toEqual(['Intersection', 'Direction', 'Ramp type', 'Ramp label', 'Status', 'Actions'])
    expect(within(sidewalks()).queryByText(RAMP)).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Ped Ramp Corners' })).not.toBeInTheDocument()
    expect(within(ramps()).queryByText('12 Main St')).not.toBeInTheDocument()
  })

  it("shows a sidewalk's borough, block and lot as the backend sends them, its violation, status and task order", async () => {
    await renderListed()
    const cells = within(rowOf('12 Main St')).getAllByRole('cell').map(td => td.textContent)
    expect(cells.slice(0, 9)).toEqual(['Queens', '123', '45', '—', '12 Main St', 'V-100', 'Task Ordered', 'Sep 14', 'TO-7'])
    const other = within(rowOf('40 Oak Ave')).getAllByRole('cell').map(td => td.textContent)
    expect(other.slice(5, 9)).toEqual(['—', `Constructed ${YEAR}-10-02`, 'Sep 14', '—'])
  })

  it("shows a ped ramp's intersection, direction, type, Ramp ID and a dash for no status, under its corner", async () => {
    await renderListed()
    const cells = within(rowOf(RAMP)).getAllByRole('cell').map(td => td.textContent)
    expect(cells.slice(0, 5)).toEqual([RAMP, 'NE', 'Perpendicular', 'R1', '—'])
    expect(cornerRow()).toHaveTextContent('Atlantic Ave & Court St — NE · Brooklyn · 1 ramp')
    // the corner's heading comes straight before its ramps
    expect(cornerRow().nextElementSibling).toBe(rowOf(RAMP))
  })

  it("shows a site's community board under CB", async () => {
    server[0] = { ...server[0], community_board: 'QN13' }
    await renderListed()
    expect(within(rowOf('12 Main St')).getAllByRole('cell')[3]).toHaveTextContent('QN13')
  })

  it('opens both sections, and folds and unfolds each by its header', async () => {
    await renderListed()
    const toggle = within(ramps()).getByRole('button', { name: /Pedestrian Ramps/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(within(sidewalks()).getByRole('button', { name: /Prior Notice/ })).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(within(ramps()).queryByRole('table')).not.toBeInTheDocument()
    expect(within(sidewalks()).getByRole('table')).toBeInTheDocument()
    await userEvent.click(toggle)
    expect(within(ramps()).getByRole('table')).toBeInTheDocument()
  })

  it('has a disabled Bulk Upload button in each section, its tooltip saying AI import is coming', async () => {
    await renderListed(DEMO_USER)
    for (const [section, label] of [[sidewalks(), 'Bulk Upload Sidewalks'], [ramps(), 'Bulk Upload Ped Ramps']]) {
      const button = within(section).getByRole('button', { name: label })
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('title', BULK_UPLOAD_TOOLTIP)
      expect(button.parentElement).toHaveAttribute('title', 'AI import — coming soon')
    }
  })

  it('shows each section empty with its message and a prominent Add for an admin', async () => {
    server = server.filter(row => row.kind === 'sidewalk')
    await renderListed()
    expect(cornerRow()).toHaveTextContent('0 ramps') // a live corner stays listed, so a ramp can be added to it
    cleanup()
    corners = []
    await renderListed()
    expect(within(ramps()).getByText('No pedestrian ramps added yet.')).toBeInTheDocument()
    expect(within(ramps()).getAllByRole('button', { name: 'Add Pedramp' })).toHaveLength(2)
  })

  it("opens a site's sketch workspace from View", async () => {
    await renderListed()
    await userEvent.click(within(rowOf(RAMP)).getByRole('link', { name: 'View' }))
    expect(screen.getByTestId('url')).toHaveTextContent(`/project/HWS0023/properties/${LISTED[2].id}/pir`)
  })

  it('links a sidewalk address to its site page', async () => {
    await renderListed()
    await userEvent.click(within(sidewalks()).getByRole('link', { name: '12 Main St' }))
    expect(screen.getByTestId('url')).toHaveTextContent(`/project/HWS0023/properties/${LISTED[0].id}`)
  })

  it('shows a load failure with Retry', async () => {
    api.listProperties.mockRejectedValueOnce(new Error('Project not found'))
    renderPage()
    expect(await screen.findByText("Couldn't load the sites: Project not found")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findAllByRole('table')).toHaveLength(2)
  })

  it('goes back to the project page', async () => {
    await renderListed(TEST_USER)
    await userEvent.click(screen.getByRole('button', { name: 'Back to Project Page' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/project/HWS0023')
  })
})

describe('PropertiesPage — who can do what', () => {
  it("lets a project member who isn't an admin add and edit, but not delete or see deleted ones", async () => {
    await renderListed(TEST_USER)
    expect(screen.queryByText(DEMO_NOTE)).not.toBeInTheDocument()
    expect(within(sidewalks()).getByRole('button', { name: 'Add Sidewalk' })).toBeInTheDocument()
    expect(within(ramps()).getByRole('button', { name: 'Add Pedramp' })).toBeInTheDocument()
    expect(within(cornerRow()).getByRole('button', { name: 'Add another ramp at this corner' })).toBeInTheDocument()
    expect(within(rowOf(RAMP)).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(within(rowOf('12 Main St')).getByRole('link', { name: 'View' })).toBeInTheDocument()
    expect(within(rowOf('12 Main St')).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Show deleted' })).not.toBeInTheDocument()

    await userEvent.click(within(rowOf('12 Main St')).getByRole('button', { name: 'Edit' }))
    await userEvent.clear(screen.getByLabelText('Address'))
    await userEvent.type(screen.getByLabelText('Address'), '14 Main St')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.updateProperty).toHaveBeenCalledWith(LISTED[0].id, { address: '14 Main St' }))
    expect(await screen.findByText('14 Main St')).toBeInTheDocument()
  })

  it('gives a demo user the list read-only: the note, and no Add, Edit or Delete', async () => {
    await renderListed(DEMO_USER)
    expect(screen.getByText(DEMO_NOTE)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Add/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(within(rowOf(RAMP)).getByRole('link', { name: 'View' })).toBeInTheDocument()
    expect(within(cornerRow()).getAllByRole('button').map(button => button.textContent)).toEqual(['Inspection Report'])
  })

  it('tells a demo user with no sites only that there are none', async () => {
    server = []
    renderPage(DEMO_USER)
    expect(await screen.findByText('No sidewalks added yet.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Add/ })).not.toBeInTheDocument()
  })

  it("shows the backend's refusal of someone not on the project as the load error", async () => {
    api.listProperties.mockRejectedValueOnce(Object.assign(new Error('Project access required'), { status: 403 }))
    renderPage(TEST_USER)
    expect(await screen.findByText("Couldn't load the sites: Project access required")).toBeInTheDocument()
  })
})

describe('PropertiesPage — adding and editing', () => {
  it('adds a sidewalk from its section, and it shows in the sidewalks table', async () => {
    await renderListed()
    await userEvent.click(within(sidewalks()).getByRole('button', { name: 'Add Sidewalk' }))
    expect(dialog()).toHaveAccessibleName('Add sidewalk')
    await userEvent.selectOptions(screen.getByLabelText('Borough'), 'Brooklyn')
    await userEvent.type(screen.getByLabelText('Block'), '00555')
    await userEvent.type(screen.getByLabelText('Lot'), '1')
    await userEvent.type(screen.getByLabelText(/Community Board/), 'BK2')
    await userEvent.type(screen.getByLabelText('Address'), '7 Elm Pl')
    await userEvent.type(screen.getByLabelText(/Violation No\./), 'V-9')
    await userEvent.selectOptions(screen.getByLabelText('Property type'), 'expedited')
    await userEvent.type(screen.getByLabelText(/Notes/), 'Corner lot')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.createProperty).toHaveBeenCalledWith('HWS0023', {
      kind: 'sidewalk', boro: 'Brooklyn', block: '555', lot: '1', community_board: 'BK2', address: '7 Elm Pl',
      violation_no: 'V-9', property_type: 'expedited', notes: 'Corner lot',
    })
    expect(within(rowOf('7 Elm Pl')).getAllByRole('cell').slice(0, 4).map(td => td.textContent))
      .toEqual(['Brooklyn', '555', '1', 'BK2'])
    expect(within(sidewalks()).getByRole('button', { name: 'Prior Notice Violation Sidewalks (3)' })).toBeInTheDocument()
  })

  it('adds a pedramp, its corner and its ramp in one call, and it shows under its new corner', async () => {
    await renderListed()
    await userEvent.click(within(ramps()).getByRole('button', { name: 'Add Pedramp' }))
    expect(dialog()).toHaveAccessibleName('Add Pedramp')
    for (const title of ['A. Location & Corner', 'B. Construction info', 'C. Inspection', 'D. This Ramp']) {
      expect(within(dialog()).getByRole('button', { name: title })).toHaveAttribute('aria-expanded', 'true')
    }
    // the facing street is offered by the streets' names once both are in
    expect(screen.getByLabelText('Facing street')).toBeDisabled()
    await userEvent.selectOptions(screen.getByLabelText('Borough'), 'Queens')
    await userEvent.type(screen.getByLabelText('North-south street'), '38 St')
    await userEvent.type(screen.getByLabelText('East-west street'), '31 Ave')
    await userEvent.selectOptions(screen.getByLabelText('Corner direction'), 'SW')
    await userEvent.type(screen.getByLabelText(/Contractor name/), 'Acme')
    await userEvent.type(screen.getByLabelText(/Inspected by/), 'RG')
    await userEvent.selectOptions(screen.getByLabelText('Quadrant'), 'SW')
    expect(within(screen.getByLabelText('Facing street')).getAllByRole('option').map(option => option.textContent))
      .toEqual(['Choose…', '38 St', '31 Ave'])
    await userEvent.selectOptions(screen.getByLabelText('Facing street'), '31 Ave')
    await userEvent.selectOptions(screen.getByLabelText('Ramp type'), 'CUT_THROUGH')
    await userEvent.type(screen.getByLabelText(/Ramp ID/), 'CT-A')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.createPedrampSite).toHaveBeenCalledTimes(1)
    const [projectId, sent] = api.createPedrampSite.mock.calls[0]
    expect(projectId).toBe('HWS0023')
    expect(sent).toMatchObject({
      boro: 'Queens', north_south_street: '38 St', east_west_street: '31 Ave', corner_direction: 'SW',
      contractor_name: 'Acme', inspected_by: 'RG', corner_type: null, quadrant: 'SW', facing_street: 'street_2',
      ramp_type: 'CUT_THROUGH', ramp_id_label: 'CT-A', notes: null,
    })
    expect(cornerRow('d0000000-0000-4000-8000-000000000002')).toHaveTextContent('38 St & 31 Ave — SW · Queens · 1 ramp')
    expect(within(rowOf('38 St & 31 Ave')).getAllByRole('cell').map(td => td.textContent).slice(0, 4))
      .toEqual(['38 St & 31 Ave', 'SW', 'Cut-through', 'CT-A'])
  })

  it('adds another ramp at a corner, its corner sections pre-filled and locked', async () => {
    await renderListed()
    await userEvent.click(within(cornerRow()).getByRole('button', { name: 'Add another ramp at this corner' }))
    expect(dialog()).toHaveAccessibleName('Add another ramp at this corner')
    const location = within(dialog()).getByRole('button', { name: 'A. Location & Corner' })
    expect(location).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(location)
    expect(screen.getByLabelText('North-south street')).toHaveDisplayValue('Atlantic Ave')
    expect(screen.getByLabelText('North-south street')).toBeDisabled()
    await userEvent.selectOptions(screen.getByLabelText('Quadrant'), 'NE')
    await userEvent.selectOptions(screen.getByLabelText('Facing street'), 'Atlantic Ave')
    await userEvent.selectOptions(screen.getByLabelText('Ramp type'), 'PARALLEL')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.createPedrampSite.mock.calls[0][1]).toMatchObject({
      boro: 'Brooklyn', north_south_street: 'Atlantic Ave', east_west_street: 'Court St', corner_direction: 'NE',
      contractor_name: 'Acme', facing_street: 'street_1', ramp_type: 'PARALLEL',
    })
    expect(cornerRow()).toHaveTextContent('2 ramps')
    expect(corners).toHaveLength(1) // the corner was reused
  })

  it('offers no Add another ramp for a corner without a direction, and says why', async () => {
    corners[0].corner_direction = null
    await renderListed()
    const add = within(cornerRow()).getByRole('button', { name: 'Add another ramp at this corner' })
    expect(add).toBeDisabled()
    expect(add.parentElement).toHaveAttribute('title', "Set this corner's direction first (Edit one of its ramps).")
  })

  it("edits a ramp on one page: the corner's sections update the corner, its own the ramp, and its Ramp ID", async () => {
    server = [...server, pedRamp(4, 'Atlantic Ave', 'Court St', { corner_id: CORNER_ID, quadrant: 'NW' })]
    await renderListed()
    await userEvent.click(within(screen.getAllByText(RAMP)[0].closest('tr')).getByRole('button', { name: 'Edit' }))
    expect(dialog()).toHaveAccessibleName('Edit Pedramp')
    expect(within(dialog()).getByText(/changes there apply to all 2 ramps at it/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Ramp ID/)).toHaveDisplayValue('R1')
    await userEvent.clear(screen.getByLabelText('East-west street'))
    await userEvent.type(screen.getByLabelText('East-west street'), 'Court Street')
    await userEvent.selectOptions(screen.getByLabelText('Ramp type'), 'PARALLEL')
    await userEvent.clear(screen.getByLabelText(/Ramp ID/))
    await userEvent.type(screen.getByLabelText(/Ramp ID/), 'R2')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.updateCorner).toHaveBeenCalledWith(CORNER_ID, { east_west_street: 'Court Street' })
    expect(api.updateProperty).toHaveBeenCalledWith(LISTED[2].id, { ramp_type: 'PARALLEL' })
    expect(api.saveRampLabel).toHaveBeenCalledWith(LISTED[2].id, 'PARALLEL', 'R2')
    // both ramps at the corner follow its new street
    await waitFor(() => expect(screen.getAllByText('Atlantic Ave & Court Street')).toHaveLength(2))
    expect(cornerRow()).toHaveTextContent('Atlantic Ave & Court Street — NE')
  })

  it('edits a ramp without a corner in the site form, under No corner', async () => {
    server[2] = { ...server[2], corner_id: null }
    await renderListed()
    expect(within(ramps()).getByText('No corner')).toBeInTheDocument()
    await userEvent.click(within(rowOf(RAMP)).getByRole('button', { name: 'Edit' }))
    expect(dialog()).toHaveAccessibleName('Edit ped ramp')
    await userEvent.selectOptions(screen.getByLabelText('Facing'), 'street_1')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.updateProperty).toHaveBeenCalledWith(LISTED[2].id, { facing_street: 'street_1' }))
  })

  it('shows a taken borough, block and lot in the dialog and adds no row', async () => {
    await renderListed()
    await userEvent.click(within(sidewalks()).getByRole('button', { name: 'Add Sidewalk' }))
    await userEvent.selectOptions(screen.getByLabelText('Borough'), 'Queens')
    await userEvent.type(screen.getByLabelText('Block'), '123')
    await userEvent.type(screen.getByLabelText('Lot'), '45')
    await userEvent.type(screen.getByLabelText('Address'), '99 Other St')
    await userEvent.selectOptions(screen.getByLabelText('Property type'), '1_3_family')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await within(dialog()).findByText(BLOCK_LOT_TAKEN)).toBeInTheDocument()
    expect(screen.getByLabelText('Address')).toHaveDisplayValue('99 Other St')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(queryRowOf('99 Other St')).toBeNull()
  })

  it("shows the backend's refusal of a kind change below the form", async () => {
    api.updateProperty.mockRejectedValueOnce(
      Object.assign(new Error('Property kind cannot be changed. Delete and recreate.'), { status: 400 }),
    )
    await renderListed()
    await userEvent.click(within(rowOf('12 Main St')).getByRole('button', { name: 'Edit' }))
    await userEvent.clear(screen.getByLabelText('Address'))
    await userEvent.type(screen.getByLabelText('Address'), '14 Main St')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('Property kind cannot be changed. Delete and recreate.')
  })
})

describe('PropertiesPage — deleting and un-deleting', () => {
  it('soft-deletes a row once confirmed, and it leaves its section', async () => {
    await renderListed()
    await userEvent.click(within(rowOf('12 Main St')).getByRole('button', { name: 'Delete' }))
    expect(dialog()).toHaveAccessibleName('Delete site Queens Block 123 Lot 45?')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(queryRowOf('12 Main St')).toBeNull())
    expect(api.softDeleteProperty).toHaveBeenCalledWith(LISTED[0].id)
    expect(screen.getByRole('status')).toHaveTextContent('Site Queens Block 123 Lot 45 deleted.')
  })

  it("deletes a corner's last ramp, then asks whether to delete the corner too", async () => {
    await renderListed()
    await userEvent.click(within(rowOf(RAMP)).getByRole('button', { name: 'Delete' }))
    const name = 'Atlantic Ave & Court St — NE Quadrant (Facing Court St)'
    expect(dialog()).toHaveAccessibleName(`Delete site ${name}?`)
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(`Site ${name} deleted.`))
    expect(await screen.findByRole('dialog', { name: 'Delete the corner too?' })).toHaveTextContent(
      'That was the last ramp at Atlantic Ave & Court St (NE).')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete corner' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.deleteCorner).toHaveBeenCalledWith(CORNER_ID)
    expect(within(ramps()).getByText('No pedestrian ramps added yet.')).toBeInTheDocument()
  })

  it('keeps the corner when asked, and asks nothing while it has other ramps', async () => {
    await renderListed()
    await userEvent.click(within(rowOf(RAMP)).getByRole('button', { name: 'Delete' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Keep corner' }))
    expect(api.deleteCorner).not.toHaveBeenCalled()
    expect(cornerRow()).toHaveTextContent('0 ramps')

    cleanup()
    server = [...structuredClone(LISTED), pedRamp(4, 'Atlantic Ave', 'Court St', { corner_id: CORNER_ID, quadrant: 'NW' })]
    await renderListed()
    await userEvent.click(within(screen.getAllByText(RAMP)[0].closest('tr')).getByRole('button', { name: 'Delete' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(cornerRow()).toHaveTextContent('1 ramp')
  })

  it('cancelling a delete changes nothing', async () => {
    await renderListed()
    await userEvent.click(within(rowOf('12 Main St')).getByRole('button', { name: 'Delete' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    expect(api.softDeleteProperty).not.toHaveBeenCalled()
    expect(rowOf('12 Main St')).toBeInTheDocument()
  })

  it('shows a deleted row muted with Deleted and Un-delete under Show deleted, and un-deleting returns it', async () => {
    server[0] = { ...server[0], deleted_at: `${YEAR}-10-01T09:00:00`, deleted_by: ADMIN.uuid }
    await renderListed()
    expect(queryRowOf('12 Main St')).toBeNull()

    await userEvent.click(showDeleted())
    await waitFor(() => expect(queryRowOf('12 Main St')).not.toBeNull())
    expect(api.listProperties).toHaveBeenLastCalledWith('HWS0023', { includeDeleted: true })
    const deleted = rowOf('12 Main St')
    expect(deleted).toHaveAttribute('data-deleted', 'true')
    expect(deleted).toHaveClass('text-gray-400')
    expect(within(deleted).getByText('12 Main St')).toHaveClass('line-through')
    expect(deleted).toHaveTextContent('Deleted')
    expect(within(deleted).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    // A deleted sidewalk doesn't count
    expect(within(sidewalks()).getByRole('button', { name: 'Prior Notice Violation Sidewalks (1)' })).toBeInTheDocument()

    await userEvent.click(within(deleted).getByRole('button', { name: 'Un-delete' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Un-delete' }))
    await waitFor(() => expect(rowOf('12 Main St')).not.toHaveAttribute('data-deleted'))
    expect(api.undeleteProperty).toHaveBeenCalledWith(LISTED[0].id)
  })

  it('shows a refused un-delete in its dialog', async () => {
    server[0] = { ...server[0], deleted_at: `${YEAR}-10-01T09:00:00` }
    api.undeleteProperty.mockRejectedValueOnce(Object.assign(
      new Error('Another site at Queens Block 123 Lot 45 now exists in this project.'), { status: 409 },
    ))
    await renderListed()
    await userEvent.click(showDeleted())
    await userEvent.click(within(await waitFor(() => rowOf('12 Main St'))).getByRole('button', { name: 'Un-delete' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Un-delete' }))
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('Another site at Queens Block 123 Lot 45 now exists in this project.')
  })
})

describe('PropertiesPage — a corner heading', () => {
  it("downloads the corner's inspection report from its heading, for anyone", async () => {
    await renderListed(DEMO_USER)
    expect(api.listCorners).toHaveBeenCalledWith('HWS0023', { includeDeleted: false })
    await userEvent.click(within(cornerRow()).getByRole('button', { name: 'Inspection Report' }))
    expect(api.downloadInspectionReport).toHaveBeenCalledWith(CORNER_ID)
  })
})
