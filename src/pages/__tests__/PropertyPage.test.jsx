import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import PropertyPage, { DEMO_NOTE, LIVE_PIR_TOOLTIP, NOT_CONFIRMED_TEXT, NO_PIR_TEXT } from '../PropertyPage'
import { PIR_TAKEN } from '../../components/PirFormModal'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

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
  property = { id: PROPERTY_ID, project_id: 'HWS0023', kind: 'sidewalk', boro: 'Queens', bbl: '4001230045',
    address: '12 Main St', display_address: '12 Main St', property_type: '4_plus_family', violation_no: 'V-77',
    notes: 'Corner lot', created_at: `${YEAR}-09-01T12:00:00`, deleted_at: null }
  pirs = []
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
  return <div data-testid="url">{useLocation().pathname}</div>
}

function renderPage(user = ADMIN) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user })
  return render(
    <MemoryRouter initialEntries={[`/project/HWS0023/properties/${PROPERTY_ID}`]}>
      <Routes>
        <Route path="/project/:projectId/properties/:propertyId" element={<PropertyPage />} />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
}

async function renderLoaded(user) {
  renderPage(user)
  await screen.findByRole('heading', { name: /HWS0023 · 12 Main St/ })
}

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
    expect(within(propertyCard()).queryByRole('button')).not.toBeInTheDocument()
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
    expect(within(propertyCard()).queryByRole('button')).not.toBeInTheDocument()
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
  it("heads the page with the project and address, and lists a sidewalk's borough, BBL, address, violation, type, notes and added", async () => {
    await renderLoaded()
    expect(api.getProperty).toHaveBeenCalledWith(PROPERTY_ID)
    expect(api.listPirs).toHaveBeenCalledWith(PROPERTY_ID, { includeDeleted: true })
    expect(valueOf(propertyCard(), 'Borough')).toHaveTextContent('Queens')
    expect(valueOf(propertyCard(), 'BBL')).toHaveTextContent('4001230045')
    expect(valueOf(propertyCard(), 'Violation No.')).toHaveTextContent('V-77')
    expect(valueOf(propertyCard(), 'Address')).toHaveTextContent('12 Main St')
    expect(valueOf(propertyCard(), 'Type')).toHaveTextContent('4+ family / commercial')
    expect(valueOf(propertyCard(), 'Notes')).toHaveTextContent('Corner lot')
    expect(valueOf(propertyCard(), 'Added')).toHaveTextContent('Sep 1')
  })

  it("heads a ped ramp's page with its intersection, and lists its quadrant, the street it faces and its type", async () => {
    property = {
      ...property, kind: 'ped_ramp', boro: 'Brooklyn', bbl: null, address: null, property_type: null, violation_no: null,
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
    expect(within(propertyCard()).queryByText('BBL')).not.toBeInTheDocument()
  })

  it('goes back to the project\'s properties', async () => {
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Back to Site Info — HWS0023' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/project/HWS0023/properties')
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
    expect(dialog()).toHaveAccessibleName('Delete site 4001230045?')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Site 4001230045 deleted.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /12 Main St/ })).toHaveTextContent('Deleted')
    expect(within(pirCard()).queryByRole('button', { name: 'Add PIR' })).not.toBeInTheDocument()

    await userEvent.click(within(propertyCard()).getByRole('button', { name: 'Un-delete' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Un-delete' }))
    expect(await within(pirCard()).findByRole('button', { name: 'Add PIR' })).toBeInTheDocument()
  })
})

describe('PropertyPage — the way into the sketch workspace', () => {
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
