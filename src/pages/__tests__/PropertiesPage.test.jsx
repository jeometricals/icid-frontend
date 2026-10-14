import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import PropertiesPage, { DEMO_NOTE, EMPTY_TEXT, EMPTY_TEXT_READ_ONLY } from '../PropertiesPage'
import { BBL_TAKEN } from '../../components/PropertyFormModal'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

// ---------------------------------------------------------------------------
// Shared mocks: a tiny in-memory "server", so the list read after a change shows what the backend wrote
// ---------------------------------------------------------------------------

const ADMIN = { ...TEST_USER, role: 'admin' }
const YEAR = new Date().getFullYear()

const property = (number, bbl, address, property_type, extra = {}) => ({
  id: `c0000000-0000-4000-8000-00000000000${number}`, project_id: 'HWS0023', bbl, address, property_type,
  notes: null, created_at: `${YEAR}-09-14T12:00:00`, updated_at: `${YEAR}-09-14T12:00:00`, created_by: ADMIN.uuid,
  deleted_at: null, deleted_by: null, pir_status: 'none', ...extra,
})
const LISTED = [
  property(1, '4001230045', '12 Main St', '1_3_family'),
  property(2, '4001230099', '40 Oak Ave', '4_plus_family', { pir_status: 'dot_signed' }),
]
const byAddress = (a, b) => a.address.localeCompare(b.address)

vi.mock('../../services/api', () => ({
  listProperties: vi.fn(), createProperty: vi.fn(), updateProperty: vi.fn(),
  softDeleteProperty: vi.fn(), undeleteProperty: vi.fn(),
}))

const conflict = () => Object.assign(new Error('A property with this BBL already exists in this project'), {
  status: 409, body: { existing_property_id: 'x' },
})
const live = (row) => !row.deleted_at

let server

beforeEach(() => {
  vi.clearAllMocks()
  server = structuredClone(LISTED)
  api.listProperties.mockImplementation(async (projectId, { includeDeleted = false } = {}) => (
    structuredClone(server.filter(row => includeDeleted || live(row)))
  ))
  api.createProperty.mockImplementation(async (projectId, values) => {
    if (server.some(row => live(row) && row.bbl === values.bbl)) throw conflict()
    const created = property(9, values.bbl, values.address, values.property_type, { notes: values.notes })
    server = [...server, created].sort(byAddress)
    return created
  })
  api.updateProperty.mockImplementation(async (id, values) => {
    if (values.bbl && server.some(row => live(row) && row.id !== id && row.bbl === values.bbl)) throw conflict()
    server = server.map(row => (row.id === id ? { ...row, ...values } : row)).sort(byAddress)
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

const table = () => screen.getByRole('table')
const rowOf = (bbl) => within(table()).getByText(bbl).closest('tr')
const queryRowOf = (bbl) => within(table()).queryByText(bbl)?.closest('tr') ?? null
const dialog = () => screen.getByRole('dialog')
const showDeleted = () => screen.getByRole('checkbox', { name: 'Show deleted' })

async function renderListed(user) {
  renderPage(user)
  await screen.findByRole('table')
}

describe('PropertiesPage — who can do what', () => {
  it("lets a project member who isn't an admin add and edit, but not delete or see deleted ones", async () => {
    await renderListed(TEST_USER)
    expect(api.listProperties).toHaveBeenCalledWith('HWS0023', { includeDeleted: false })
    expect(screen.getByRole('button', { name: 'Add site' })).toBeInTheDocument()
    expect(within(rowOf('4001230045')).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(within(table()).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Show deleted' })).not.toBeInTheDocument()

    await userEvent.click(within(rowOf('4001230045')).getByRole('button', { name: 'Edit' }))
    await userEvent.clear(screen.getByLabelText('Address'))
    await userEvent.type(screen.getByLabelText('Address'), '14 Main St')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(rowOf('4001230045')).toHaveTextContent('14 Main St'))
  })

  it('gives a demo user the list read-only: no Add, no Actions column, and a note saying so', async () => {
    await renderListed(DEMO_USER)
    expect(screen.getByText(DEMO_NOTE)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add site' })).not.toBeInTheDocument()
    expect(within(table()).getAllByRole('columnheader').map(th => th.textContent))
      .toEqual(['BBL', 'Address', 'Type', 'PIR', 'Added'])
    expect(within(table()).queryByRole('button')).not.toBeInTheDocument()
  })

  it("tells a demo user with no properties only that there are none", async () => {
    server = []
    renderPage(DEMO_USER)
    expect(await screen.findByText(EMPTY_TEXT_READ_ONLY)).toBeInTheDocument()
  })

  it("shows the backend's refusal of someone not on the project as the load error", async () => {
    api.listProperties.mockRejectedValueOnce(Object.assign(new Error('Project access required'), { status: 403 }))
    renderPage(TEST_USER)
    expect(await screen.findByText("Couldn't load the sites: Project access required")).toBeInTheDocument()
  })

  it('goes back to the project page', async () => {
    await renderListed(TEST_USER)
    await userEvent.click(screen.getByRole('button', { name: 'Back to Project Page' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/project/HWS0023')
  })
})

describe('PropertiesPage — the list', () => {
  it('heads the page with the project and lists BBL, address, type label, PIR status and added date', async () => {
    await renderListed()
    expect(screen.getByRole('heading', { name: 'Site Info — HWS0023' })).toBeInTheDocument()
    expect(api.listProperties).toHaveBeenCalledWith('HWS0023', { includeDeleted: false })
    expect(within(table()).getAllByRole('columnheader').map(th => th.textContent))
      .toEqual(['BBL', 'Address', 'Type', 'PIR', 'Added', 'Actions'])
    const cells = within(rowOf('4001230045')).getAllByRole('cell').map(td => td.textContent)
    expect(cells.slice(0, 5)).toEqual(['4001230045', '12 Main St', '1-3 family', '—', 'Sep 14'])
    expect(rowOf('4001230099')).toHaveTextContent('4+ family / commercial')
  })

  it.each([
    ['no live PIR', 'none', '—'],
    ['a PIR signed by DOT', 'dot_signed', 'Signed by DOT'],
    ['a PIR with the as-built signed', 'as_built_signed', 'As-built signed'],
  ])("shows a row with %s by its list's pir_status", async (_, status, label) => {
    const bbl = server[1].bbl
    server[1].pir_status = status
    await renderListed()
    const pirCell = within(rowOf(bbl)).getAllByRole('cell')[3]
    expect(pirCell).toHaveTextContent(label)
  })

  it("links each BBL to the property's page", async () => {
    await renderListed()
    await userEvent.click(within(table()).getByRole('link', { name: '4001230045' }))
    expect(screen.getByTestId('url')).toHaveTextContent(`/project/HWS0023/properties/${LISTED[0].id}`)
  })

  it('shows the empty state when the project has none', async () => {
    server = []
    renderPage()
    expect(await screen.findByText(EMPTY_TEXT)).toBeInTheDocument()
  })

  it('shows a load failure with Retry', async () => {
    api.listProperties.mockRejectedValueOnce(new Error('Project not found'))
    renderPage()
    expect(await screen.findByText("Couldn't load the sites: Project not found")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })
})

describe('PropertiesPage — adding and editing', () => {
  it('adds a property, and the list read again shows it with its type label', async () => {
    await renderListed()
    await userEvent.click(screen.getByRole('button', { name: 'Add site' }))
    expect(dialog()).toHaveAccessibleName('Add site')
    await userEvent.type(screen.getByLabelText('BBL'), '4005550001')
    await userEvent.type(screen.getByLabelText('Address'), '7 Elm Pl')
    await userEvent.selectOptions(screen.getByLabelText('Site type'), 'expedited')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.createProperty).toHaveBeenCalledWith('HWS0023', {
      bbl: '4005550001', address: '7 Elm Pl', property_type: 'expedited', notes: null,
    })
    expect(rowOf('4005550001')).toHaveTextContent('7 Elm Pl')
    expect(rowOf('4005550001')).toHaveTextContent('Expedited')
  })

  it('shows a duplicate BBL in the dialog and adds no row', async () => {
    await renderListed()
    await userEvent.click(screen.getByRole('button', { name: 'Add site' }))
    await userEvent.type(screen.getByLabelText('BBL'), '4001230045')
    await userEvent.type(screen.getByLabelText('Address'), '99 Other St')
    await userEvent.selectOptions(screen.getByLabelText('Site type'), '1_3_family')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await within(dialog()).findByText(BBL_TAKEN)).toBeInTheDocument()
    expect(screen.getByLabelText('Address')).toHaveDisplayValue('99 Other St')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(within(table()).queryByText('99 Other St')).not.toBeInTheDocument()
    expect(within(table()).getAllByRole('row')).toHaveLength(3) // the heading and the two properties
  })

  it('edits a row from its pre-filled dialog, and the list reflects the change', async () => {
    await renderListed()
    await userEvent.click(within(rowOf('4001230045')).getByRole('button', { name: 'Edit' }))
    expect(dialog()).toHaveAccessibleName('Edit site')
    const address = screen.getByLabelText('Address')
    expect(address).toHaveDisplayValue('12 Main St')
    await userEvent.clear(address)
    await userEvent.type(address, '14 Main St')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.updateProperty).toHaveBeenCalledWith(LISTED[0].id, { address: '14 Main St' })
    expect(rowOf('4001230045')).toHaveTextContent('14 Main St')
  })
})

describe('PropertiesPage — deleting and un-deleting', () => {
  it('soft-deletes a row once confirmed, and it leaves the list', async () => {
    await renderListed()
    await userEvent.click(within(rowOf('4001230045')).getByRole('button', { name: 'Delete' }))
    expect(dialog()).toHaveAccessibleName('Delete site 4001230045?')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(queryRowOf('4001230045')).toBeNull())
    expect(api.softDeleteProperty).toHaveBeenCalledWith(LISTED[0].id)
    expect(screen.getByRole('status')).toHaveTextContent('Site 4001230045 deleted.')
  })

  it('cancelling a delete changes nothing', async () => {
    await renderListed()
    await userEvent.click(within(rowOf('4001230045')).getByRole('button', { name: 'Delete' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    expect(api.softDeleteProperty).not.toHaveBeenCalled()
    expect(rowOf('4001230045')).toBeInTheDocument()
  })

  it('shows a deleted row muted with Un-delete under Show deleted, and un-deleting returns it to the list', async () => {
    server[0] = { ...server[0], deleted_at: `${YEAR}-10-01T09:00:00`, deleted_by: ADMIN.uuid }
    await renderListed()
    expect(queryRowOf('4001230045')).toBeNull()

    await userEvent.click(showDeleted())
    await waitFor(() => expect(queryRowOf('4001230045')).not.toBeNull())
    expect(api.listProperties).toHaveBeenLastCalledWith('HWS0023', { includeDeleted: true })
    const deleted = rowOf('4001230045')
    expect(deleted).toHaveAttribute('data-deleted', 'true')
    expect(deleted).toHaveClass('text-gray-400')
    expect(within(deleted).getByText('4001230045')).toHaveClass('line-through')
    expect(within(deleted).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(within(deleted).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(rowOf('4001230099')).not.toHaveAttribute('data-deleted')

    await userEvent.click(within(deleted).getByRole('button', { name: 'Un-delete' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Un-delete' }))
    await waitFor(() => expect(rowOf('4001230045')).not.toHaveAttribute('data-deleted'))
    expect(api.undeleteProperty).toHaveBeenCalledWith(LISTED[0].id)

    await userEvent.click(showDeleted())
    await waitFor(() => expect(api.listProperties).toHaveBeenLastCalledWith('HWS0023', { includeDeleted: false }))
    expect(within(rowOf('4001230045')).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('shows a refused un-delete in its dialog', async () => {
    server[0] = { ...server[0], deleted_at: `${YEAR}-10-01T09:00:00` }
    api.undeleteProperty.mockRejectedValueOnce(Object.assign(
      new Error('Another property in this project now has this BBL'), { status: 409 },
    ))
    await renderListed()
    await userEvent.click(showDeleted())
    await userEvent.click(within(await waitFor(() => rowOf('4001230045'))).getByRole('button', { name: 'Un-delete' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Un-delete' }))
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('Another property in this project now has this BBL')
  })
})
