import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import PedRampInspectionPage, { APPROVED_LOCK, SUBMITTED_LOCK } from '../PedRampInspectionPage'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { ProjectRolesContext } from '../../contexts/ProjectRolesContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

// ---------------------------------------------------------------------------
// Shared mocks: a corner with two ramps and its inspection, held in memory so each move shows what it wrote
// ---------------------------------------------------------------------------

const ADMIN = { ...TEST_USER, role: 'admin' }
const MEMBER = { ...TEST_USER, role: null }
const CORNER_ID = 'd0000000-0000-4000-8000-000000000001'
const RAMP_1 = 'c0000000-0000-4000-8000-000000000001'
const RAMP_2 = 'c0000000-0000-4000-8000-000000000002'
const CORNER = {
  corner_id: CORNER_ID, project_id: 'HWS0023', boro: 'Queens', north_south_street: '3rd Ave',
  east_west_street: '38 Street', corner_direction: 'NE', corner_type: 'intersection_corner', inspected_by: 'RG',
  entity: 'ddc_prior_notice', t_intersection: false, deleted_at: null,
  ramps: [
    { property_id: RAMP_1, ramp_type: 'PERPENDICULAR', quadrant: 'NE', facing_street: 'street_1',
      intersection_street_1: '3rd Ave', intersection_street_2: '38 Street', ramp_id_label: 'R1', has_attributes: false },
    { property_id: RAMP_2, ramp_type: 'PARALLEL', quadrant: 'NE', facing_street: 'street_2',
      intersection_street_1: '3rd Ave', intersection_street_2: '38 Street', ramp_id_label: null, has_attributes: false },
  ],
}
const DRAFT = { id: 'e0000000-0000-4000-8000-000000000001', corner_id: CORNER_ID, status: 'draft',
  requirements_met: null, return_comment: null, tif_count: 0, draft_tif_count: 0 }

// The photo section is tested on its own; here it reports the form's photos as photosOnForm says
let photosOnForm = []
vi.mock('../../components/PedRampPhotosSection', async () => {
  const { useEffect } = await import('react')
  return {
    NO_PHOTOS_WARNING: 'No photos yet: DOT asks for at least four of each ramp. You can still submit for the pilot.',
    default: function PhotosStub({ parent, propertyId, canEdit, onPhotosChange }) {
      useEffect(() => { onPhotosChange?.(photosOnForm) }, [onPhotosChange])
      return <div data-testid="photos" data-parent={`${parent.type}:${parent.id}`} data-ramp={propertyId ?? ''} data-can-edit={String(canEdit)} />
    },
  }
})

vi.mock('../../services/api', () => ({
  getCorner: vi.fn(), getCornerInspection: vi.fn(), startInspection: vi.fn(), updateInspection: vi.fn(),
  submitInspection: vi.fn(), returnInspection: vi.fn(), approveInspection: vi.fn(), updateCorner: vi.fn(),
  getRampAttributes: vi.fn(), saveRampAttributes: vi.fn(), listInspectionTifs: vi.fn(), getInspectionReport: vi.fn(),
  draftTif: vi.fn(), downloadInspectionDotForms: vi.fn(), downloadInspectionReport: vi.fn(),
}))

let inspection

beforeEach(() => {
  vi.clearAllMocks()
  photosOnForm = []
  inspection = null
  api.getCorner.mockImplementation(async () => structuredClone(CORNER))
  api.getCornerInspection.mockImplementation(async () => structuredClone(inspection))
  api.getRampAttributes.mockResolvedValue(null)
  api.listInspectionTifs.mockResolvedValue([])
  // the first ramp's attributes raise an ADA warning, the second's none
  api.getInspectionReport.mockResolvedValue({ ramps: [
    { property_id: RAMP_1, attributes: { warnings: [{ field: 'ramp_running_slope_pct' }] } },
    { property_id: RAMP_2, attributes: null },
  ] })
  api.draftTif.mockResolvedValue({ id: 'f0000000-0000-4000-8000-000000000001' })
  api.startInspection.mockImplementation(async () => { inspection = { ...DRAFT }; return inspection })
  api.updateInspection.mockImplementation(async (id, value) => ({ ...inspection, requirements_met: value }))
  api.submitInspection.mockImplementation(async () => ({ ...inspection, status: 'submitted', inspector_name: 'Ada Admin',
    submitted_at: '2026-10-21T13:00:00Z' }))
  api.returnInspection.mockImplementation(async (id, comment) => ({ ...inspection, status: 'draft', return_comment: comment,
    returned_by_name: 'Rita RE', returned_at: '2026-10-21T14:00:00Z' }))
  api.approveInspection.mockImplementation(async () => ({ ...inspection, status: 'approved', re_name: 'Rita RE',
    re_signed_at: '2026-10-21T15:00:00Z' }))
  api.updateCorner.mockImplementation(async (id, values) => ({ ...CORNER, ...values }))
})

function CurrentUrl() {
  return <div data-testid="url">{useLocation().pathname}</div>
}

function renderPage({ user = ADMIN, roles = [], entry = `/project/HWS0023/ped-ramp-corners/${CORNER_ID}/inspection` } = {}) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user })
  return render(
    <ProjectRolesContext.Provider value={{ rolesByProject: { HWS0023: roles }, error: null, reload: () => {} }}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/project/:projectId/ped-ramp-corners/:cornerId/inspection" element={<PedRampInspectionPage />} />
          <Route path="*" element={<CurrentUrl />} />
        </Routes>
      </MemoryRouter>
    </ProjectRolesContext.Provider>,
  )
}

const loaded = () => screen.findByRole('heading', { name: 'As-Built Inspection Form — 3rd Ave & 38 Street — NE' })
const dialog = () => screen.getByRole('dialog')

describe('PedRampInspectionPage — the form', () => {
  it("shows the corner's sections 1-4 and a card per ramp, before any inspection", async () => {
    renderPage({ user: MEMBER, roles: ['inspector'] })
    await loaded()
    expect(screen.getByText('Not started')).toBeInTheDocument()
    const corner = screen.getByRole('region', { name: 'Corner' })
    expect(within(corner).getByText('DDC Prior Notice Contract')).toBeInTheDocument()
    expect(within(corner).getByText('Intersection corner')).toBeInTheDocument()
    expect(within(corner).getByText('Ramp types at this corner: Perpendicular, Parallel')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Ramp R1' })).toHaveTextContent('Perpendicular · NE · facing 3rd Ave')
    expect(screen.getByRole('region', { name: 'Ramp 2' })).toHaveTextContent('Parallel · NE · facing 38 Street')
    expect(api.getRampAttributes).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('region', { name: 'ADA requirements' })).not.toBeInTheDocument()
  })

  it("opens at a ramp's card from a ramp row's link", async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    renderPage({ entry: `/project/HWS0023/ped-ramp-corners/${CORNER_ID}/inspection#ramp-${RAMP_2}` })
    await loaded()
    await waitFor(() => expect(scroll).toHaveBeenCalled())
    expect(scroll.mock.contexts[0]).toBe(document.getElementById(`ramp-${RAMP_2}`))
    delete Element.prototype.scrollIntoView
  })

  it('shows a load failure with Retry, and goes back to Site Info', async () => {
    api.getCorner.mockRejectedValueOnce(new Error('Corner not found'))
    renderPage()
    expect(await screen.findByText("Couldn't load the inspection: Corner not found")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await loaded()
    await userEvent.click(screen.getByRole('button', { name: 'Back to Site Info' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/project/HWS0023/properties')
  })
})

describe('PedRampInspectionPage — the workflow', () => {
  it('lets an inspector start it, answer the requirements and submit it', async () => {
    renderPage({ user: MEMBER, roles: ['inspector'] })
    await loaded()
    await userEvent.click(screen.getByRole('button', { name: 'Start inspection' }))
    expect(await screen.findByText('Draft')).toBeInTheDocument()
    expect(api.startInspection).toHaveBeenCalledWith(CORNER_ID)

    await userEvent.click(within(screen.getByRole('region', { name: 'ADA requirements' })).getByLabelText('No'))
    expect(api.updateInspection).toHaveBeenCalledWith(DRAFT.id, false)
    expect(await screen.findByText(/needs a Technical Infeasibility Form/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(dialog()).toHaveAccessibleName('Submit inspection?')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Submitted')).toBeInTheDocument()
    expect(screen.getByText(/Submitted by Ada Admin on Oct 21, 2026/)).toBeInTheDocument()
    // an inspector who isn't the RE now reads it locked
    expect(screen.getByText(SUBMITTED_LOCK)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit corner' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'ADA requirements' })).getByLabelText('Yes')).toBeDisabled()
  })

  it("keeps a refused submit in its dialog, as the backend words it", async () => {
    inspection = { ...DRAFT }
    api.submitInspection.mockRejectedValueOnce(Object.assign(
      new Error('Signature required before signing an inspection'), { status: 400 }))
    renderPage({ user: MEMBER, roles: ['inspector'] })
    await loaded()
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Submit' }))
    expect(await within(dialog()).findByText('Signature required before signing an inspection')).toBeInTheDocument()
  })

  it('lets the RE return it with a comment, which its inspector then reads', async () => {
    inspection = { ...DRAFT, status: 'submitted' }
    renderPage({ user: MEMBER, roles: ['re'] })
    await loaded()
    expect(screen.queryByText(SUBMITTED_LOCK)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit corner' })).toBeInTheDocument() // the RE edits
    await userEvent.click(screen.getByRole('button', { name: 'Return' }))
    const returnButton = within(dialog()).getByRole('button', { name: 'Return' })
    expect(returnButton).toBeDisabled() // the comment is required
    await userEvent.type(within(dialog()).getByRole('textbox'), 'Check the landing slope')
    await userEvent.click(returnButton)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.returnInspection).toHaveBeenCalledWith(DRAFT.id, 'Check the landing slope')
    expect(screen.getByText('Returned')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Returned by Rita RE on Oct 21, 2026')
    expect(screen.getByRole('note')).toHaveTextContent('Check the landing slope')
  })

  it('lets the RE approve it, which freezes it for everyone', async () => {
    inspection = { ...DRAFT, status: 'submitted' }
    renderPage({ user: MEMBER, roles: ['re'] })
    await loaded()
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByText(/Approved by Rita RE on Oct 21, 2026/)).toBeInTheDocument()
    expect(screen.getByText(APPROVED_LOCK)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Return|Approve|Submit|Edit corner/ })).not.toBeInTheDocument()
  })

  it("shows the draft-TIF refusal of an approval in its dialog", async () => {
    inspection = { ...DRAFT, status: 'submitted' }
    api.approveInspection.mockRejectedValueOnce(Object.assign(
      new Error("Approve or delete this inspection's draft TIFs first"), { status: 409 }))
    renderPage()
    await loaded()
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Approve' }))
    expect(await within(dialog()).findByText("Approve or delete this inspection's draft TIFs first")).toBeInTheDocument()
  })

  it('gives an OE and a demo user no moves; the OE still edits a draft, the demo user nothing', async () => {
    inspection = { ...DRAFT }
    renderPage({ user: MEMBER, roles: ['oe'] })
    await loaded()
    expect(screen.queryByRole('button', { name: /Submit|Start inspection/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit corner' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'ADA requirements' })).getByLabelText('Yes')).toBeDisabled()
  })

  it('gives a demo user the form read-only', async () => {
    inspection = { ...DRAFT }
    renderPage({ user: DEMO_USER, roles: ['inspector'] })
    await loaded()
    expect(screen.queryByRole('button', { name: /Submit|Edit corner/ })).not.toBeInTheDocument()
  })
})

describe('PedRampInspectionPage — the corner', () => {
  it("edits the corner's sections in the Pedramp dialog, its ramps not asked for", async () => {
    inspection = { ...DRAFT }
    renderPage()
    await loaded()
    await userEvent.click(screen.getByRole('button', { name: 'Edit corner' }))
    expect(dialog()).toHaveAccessibleName('Edit corner')
    expect(within(dialog()).getByText('Changes apply to the corner and to all 2 ramps at it.')).toBeInTheDocument()
    expect(within(dialog()).queryByRole('button', { name: 'D. This Ramp' })).not.toBeInTheDocument()
    await userEvent.clear(within(dialog()).getByLabelText(/Inspected by/))
    await userEvent.type(within(dialog()).getByLabelText(/Inspected by/), 'MK')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.updateCorner).toHaveBeenCalledWith(CORNER_ID, { inspected_by: 'MK' })
    expect(within(screen.getByRole('region', { name: 'Corner' })).getByText('MK')).toBeInTheDocument()
  })

  it("shows the backend's lock refusal of a corner edit in the dialog", async () => {
    inspection = { ...DRAFT }
    api.updateCorner.mockRejectedValueOnce(Object.assign(new Error(SUBMITTED_LOCK), { status: 403 }))
    renderPage()
    await loaded()
    await userEvent.click(screen.getByRole('button', { name: 'Edit corner' }))
    await userEvent.type(within(dialog()).getByLabelText(/Inspected by/), 'X')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Save' }))
    expect(await within(dialog()).findByText(SUBMITTED_LOCK)).toBeInTheDocument()
  })
})

describe('PedRampInspectionPage — photos', () => {
  it("puts each ramp's photos on its card, editable while the form is", async () => {
    inspection = { ...DRAFT }
    renderPage({ user: MEMBER, roles: ['inspector'] })
    await loaded()
    const stubs = screen.getAllByTestId('photos')
    expect(stubs.map(stub => stub.dataset.ramp)).toEqual([RAMP_1, RAMP_2])
    expect(stubs[0].dataset.parent).toBe(`inspection:${DRAFT.id}`)
    expect(stubs[0].dataset.canEdit).toBe('true')
  })

  it('warns, without stopping it, before submitting a form with no photos', async () => {
    inspection = { ...DRAFT }
    renderPage({ user: MEMBER, roles: ['inspector'] })
    await loaded()
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(within(dialog()).getByText(/No photos yet: DOT asks for at least four/)).toBeInTheDocument()
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(api.submitInspection).toHaveBeenCalled())
  })

  it('says nothing about photos when the form has some, and shows none before a start', async () => {
    photosOnForm = [{ id: 'p1', photo_number: 1 }]
    inspection = { ...DRAFT }
    renderPage({ user: MEMBER, roles: ['inspector'] })
    await loaded()
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(within(dialog()).queryByText(/No photos yet/)).not.toBeInTheDocument()
  })
})

describe('PedRampInspectionPage — TIFs and downloads', () => {
  it("offers Draft TIF on a warned ramp once the requirements aren't met, and opens it", async () => {
    inspection = { ...DRAFT, requirements_met: false }
    renderPage({ user: MEMBER, roles: ['inspector'] })
    await loaded()
    const first = screen.getByRole('region', { name: 'Ramp R1' })
    await waitFor(() => expect(within(first).getByRole('button', { name: 'Draft TIF' })).toBeInTheDocument())
    expect(within(screen.getByRole('region', { name: 'Ramp 2' })).queryByText(/needs a TIF/)).not.toBeInTheDocument()
    await userEvent.click(within(first).getByRole('button', { name: 'Draft TIF' }))
    expect(api.draftTif).toHaveBeenCalledWith(DRAFT.id, RAMP_1)
    expect(screen.getByTestId('url')).toHaveTextContent('/project/HWS0023/ped-ramp-tifs/f0000000-0000-4000-8000-000000000001')
  })

  it("shows a ramp's TIF with its status instead, and nothing while the requirements are met", async () => {
    inspection = { ...DRAFT, requirements_met: false }
    api.listInspectionTifs.mockResolvedValue([{ id: 'f1', property_id: RAMP_1, status: 'approved' }])
    renderPage()
    await loaded()
    const first = screen.getByRole('region', { name: 'Ramp R1' })
    const link = await within(first).findByRole('link', { name: 'Technical Infeasibility Form' })
    expect(link).toHaveAttribute('href', '/project/HWS0023/ped-ramp-tifs/f1')
    expect(within(first).getByText('Approved')).toBeInTheDocument()
  })

  it('gives a demo user no Draft TIF', async () => {
    inspection = { ...DRAFT, requirements_met: false }
    renderPage({ user: DEMO_USER, roles: ['inspector'] })
    await loaded()
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Ramp R1' })).getByText(/needs a TIF/)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Draft TIF' })).not.toBeInTheDocument()
  })

  it('downloads the ICID preview for anyone and the DOT form once approved, with the note on several files', async () => {
    inspection = { ...DRAFT, status: 'approved', has_dot_pdf: true, re_signed_at: '2026-10-21T15:00:00Z' }
    renderPage({ user: DEMO_USER })
    await loaded()
    await userEvent.click(screen.getByRole('button', { name: 'Preview (ICID)' }))
    expect(api.downloadInspectionReport).toHaveBeenCalledWith(CORNER_ID)
    await userEvent.click(screen.getByRole('button', { name: 'Download DOT form' }))
    expect(api.downloadInspectionDotForms).toHaveBeenCalledWith(DRAFT.id)
    expect(screen.getByText(/comes as several forms in a ZIP/)).toHaveTextContent('choose No: nothing was edited')
  })

  it('has no DOT form before approval', async () => {
    inspection = { ...DRAFT, status: 'submitted' }
    renderPage()
    await loaded()
    expect(screen.queryByRole('button', { name: 'Download DOT form' })).not.toBeInTheDocument()
  })
})
