import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import PedRampTifPage, { SIGNATURE_NOTE, TIF_APPROVED_LOCK } from '../PedRampTifPage'
import { APPROVED_LOCK, SUBMITTED_LOCK } from '../PedRampInspectionPage'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { ProjectRolesContext } from '../../contexts/ProjectRolesContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

const ADMIN = { ...TEST_USER, role: 'admin', first_name: 'Ada', last_name: 'Admin' }
const MEMBER = { ...TEST_USER, role: null, first_name: 'Rita', last_name: 'Engineer' }
const TIF_ID = 'f0000000-0000-4000-8000-000000000001'
const CORNER_ID = 'd0000000-0000-4000-8000-000000000001'
const RAMP_ID = 'c0000000-0000-4000-8000-000000000001'
const DRAFT = {
  id: TIF_ID, property_id: RAMP_ID, corner_id: CORNER_ID, inspection_id: 'e1', project_id: 'HWS0023',
  inspection_status: 'draft', status: 'draft', ramp_type: 'PERPENDICULAR', quadrant: 'NE', ramp_id_label: 'R1',
  dot_corner_id: 'QN-123', dot_ramp_id: 'R1', ramp_construction: 'new_installation', element_running_slope: false,
  why_requirements_cannot_be_achieved: null, project_category: null, signer_name: null, signed_at: null,
}

vi.mock('../../services/api', () => ({
  getTif: vi.fn(), updateTif: vi.fn(), approveTif: vi.fn(), deleteTif: vi.fn(), downloadTifForm: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  api.getTif.mockResolvedValue({ ...DRAFT })
  api.updateTif.mockImplementation(async (id, changes) => ({ ...DRAFT, ...changes }))
  api.approveTif.mockImplementation(async (id, signer) => ({ ...DRAFT, ...signer, status: 'approved',
    signed_at: '2026-10-21T15:00:00Z' }))
  api.deleteTif.mockResolvedValue()
})

function CurrentUrl() {
  const { pathname, hash } = useLocation()
  return <div data-testid="url">{pathname}{hash}</div>
}

function renderPage({ user = ADMIN, roles = [] } = {}) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user })
  return render(
    <ProjectRolesContext.Provider value={{ rolesByProject: { HWS0023: roles }, error: null, reload: () => {} }}>
      <MemoryRouter initialEntries={[`/project/HWS0023/ped-ramp-tifs/${TIF_ID}`]}>
        <Routes>
          <Route path="/project/:projectId/ped-ramp-tifs/:tifId" element={<PedRampTifPage />} />
          <Route path="*" element={<CurrentUrl />} />
        </Routes>
      </MemoryRouter>
    </ProjectRolesContext.Provider>,
  )
}

const loaded = () => screen.findByRole('heading', { name: /Technical Infeasibility Form — Ramp R1/ })

describe('PedRampTifPage', () => {
  it("shows DOT's sections 1-7, prefilled, and saves only what changed", async () => {
    renderPage({ user: MEMBER, roles: ['inspector'] })
    await loaded()
    expect(screen.getByLabelText('Corner ID')).toHaveDisplayValue('QN-123')
    expect(screen.getByLabelText('Ramp construction')).toHaveDisplayValue('New installation')
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    await userEvent.click(screen.getByLabelText('Ramp running slope'))
    await userEvent.type(screen.getByLabelText('Explanation'), 'A vault under the corner')
    await userEvent.clear(screen.getByLabelText('Ramp ID'))
    await userEvent.click(save)
    await waitFor(() => expect(api.updateTif).toHaveBeenCalledWith(TIF_ID, {
      element_running_slope: true, why_requirements_cannot_be_achieved: 'A vault under the corner', dot_ramp_id: null,
    }))
    // an inspector doesn't sign
    expect(screen.queryByRole('region', { name: 'Sign and approve' })).not.toBeInTheDocument()
  })

  it('lets the RE sign and approve with their name and licence, which freezes it', async () => {
    renderPage({ user: MEMBER, roles: ['re'] })
    await loaded()
    const panel = screen.getByRole('region', { name: 'Sign and approve' })
    expect(within(panel).getByText(SIGNATURE_NOTE)).toBeInTheDocument()
    expect(within(panel).getByLabelText(/^Name/)).toHaveDisplayValue('Rita Engineer')
    const sign = within(panel).getByRole('button', { name: 'Sign & Approve' })
    expect(sign).toBeDisabled() // the licence is required
    await userEvent.type(within(panel).getByLabelText('New York licence No.'), 'PE-1234')
    await userEvent.click(sign)
    await waitFor(() => expect(api.approveTif).toHaveBeenCalledWith(TIF_ID, {
      signer_name: 'Rita Engineer', signer_ny_license_no: 'PE-1234',
    }))
    expect(await screen.findByText(TIF_APPROVED_LOCK)).toBeInTheDocument()
    expect(screen.getByText(/Signed by Rita Engineer \(NY licence PE-1234\) on Oct 21, 2026/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Corner ID')).toBeDisabled()
  })

  it("follows the inspection's lock", async () => {
    api.getTif.mockResolvedValue({ ...DRAFT, inspection_status: 'submitted' })
    renderPage({ user: MEMBER, roles: ['inspector'] })
    await loaded()
    expect(screen.getByText(SUBMITTED_LOCK)).toBeInTheDocument()
    expect(screen.getByLabelText('Corner ID')).toBeDisabled()
  })

  it("keeps an approved inspection's TIF frozen, with no Delete", async () => {
    api.getTif.mockResolvedValue({ ...DRAFT, inspection_status: 'approved' })
    renderPage()
    await loaded()
    expect(screen.getByText(APPROVED_LOCK)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('lets an admin delete it, confirmed, back to its ramp on the inspection', async () => {
    renderPage()
    await loaded()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(api.deleteTif).toHaveBeenCalledWith(TIF_ID))
    expect(screen.getByTestId('url')).toHaveTextContent(`/project/HWS0023/ped-ramp-corners/${CORNER_ID}/inspection#ramp-${RAMP_ID}`)
  })

  it('downloads its DOT form for anyone, a demo user reading only', async () => {
    renderPage({ user: DEMO_USER, roles: ['inspector'] })
    await loaded()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Download TIF form' }))
    expect(api.downloadTifForm).toHaveBeenCalledWith(TIF_ID)
  })

  it("shows a refused save as the backend words it", async () => {
    api.updateTif.mockRejectedValueOnce(Object.assign(new Error(TIF_APPROVED_LOCK), { status: 409 }))
    renderPage()
    await loaded()
    await userEvent.click(screen.getByLabelText('Flare slopes'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(TIF_APPROVED_LOCK)
  })
})
