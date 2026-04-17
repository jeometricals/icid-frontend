import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProjectDashboard from '../ProjectDashboard'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const DEV_USER = {
  id: 28,
  email: 'KhanG@magnoleng.pc',
  user_metadata: { full_name: 'Genghis Khan' }
}

const MOCK_PROJECT = {
  project_id: 'HWS0023',
  project_name: 'Curb & Sidewalk Installation',
  project_description: 'Installation at various locations in Queens.',
  registration_code: 'REG-2024-001',
  borough: 'Queens',
  status: 'active',
}

function mockAuth(overrides = {}) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    user: DEV_USER,
    isDemoMode: false,
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...overrides
  })
}

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => mockNavigate }
})

// Render the dashboard at a specific project route so useParams works
function renderDashboard(projectId = 'HWS0023') {
  return render(
    <MemoryRouter initialEntries={[`/project/${projectId}`]}>
      <Routes>
        <Route path="/project/:projectId" element={<ProjectDashboard />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  mockNavigate.mockReset()
})

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe('ProjectDashboard loading', () => {
  it('shows a spinner while project is being fetched', () => {
    mockAuth()
    vi.spyOn(api, 'getProjectById').mockReturnValue(new Promise(() => {}))
    renderDashboard()
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Successful fetch
// ---------------------------------------------------------------------------

describe('ProjectDashboard with project data', () => {
  beforeEach(() => {
    mockAuth()
    vi.spyOn(api, 'getProjectById').mockResolvedValue(MOCK_PROJECT)
  })

  it('calls getProjectById with the route project ID', async () => {
    renderDashboard('HWS0023')
    await waitFor(() => expect(api.getProjectById).toHaveBeenCalledWith('HWS0023'))
  })

  it('renders the contract number', async () => {
    renderDashboard()
    await waitFor(() => screen.getByText('HWS0023'))
    expect(screen.getByText('HWS0023')).toBeInTheDocument()
  })

  it('renders the registration code', async () => {
    renderDashboard()
    await waitFor(() => screen.getByText('REG-2024-001'))
    expect(screen.getByText('REG-2024-001')).toBeInTheDocument()
  })

  it('renders the project name', async () => {
    renderDashboard()
    await waitFor(() => screen.getByText('Curb & Sidewalk Installation'))
    expect(screen.getByText('Curb & Sidewalk Installation')).toBeInTheDocument()
  })

  it('renders the project description', async () => {
    renderDashboard()
    await waitFor(() => screen.getByText(/Installation at various locations/))
    expect(screen.getByText(/Installation at various locations/)).toBeInTheDocument()
  })

  it('renders the borough', async () => {
    renderDashboard()
    await waitFor(() => screen.getByText('Queens'))
    expect(screen.getByText('Queens')).toBeInTheDocument()
  })

  it('renders all report type cards', async () => {
    renderDashboard()
    await waitFor(() => screen.getByText('General'))
    expect(screen.getByText('General')).toBeInTheDocument()
    expect(screen.getByText('Daily Site Patrol')).toBeInTheDocument()
    expect(screen.getByText(/Curb, Sidewalk/)).toBeInTheDocument()
  })

  it('navigates to the correct report path when a report card is clicked', async () => {
    renderDashboard()
    await waitFor(() => screen.getByText('General'))
    await userEvent.click(screen.getByText('General').closest('button'))
    expect(mockNavigate).toHaveBeenCalledWith('/project/HWS0023/report/general')
  })

  it('navigates back to /projects when back button is clicked', async () => {
    renderDashboard()
    await waitFor(() => screen.getByText('Back to Project List'))
    await userEvent.click(screen.getByText('Back to Project List'))
    expect(mockNavigate).toHaveBeenCalledWith('/projects')
  })
})

// ---------------------------------------------------------------------------
// Project not found
// ---------------------------------------------------------------------------

describe('ProjectDashboard project not found', () => {
  it('shows the not-found message when API throws', async () => {
    mockAuth()
    vi.spyOn(api, 'getProjectById').mockRejectedValue(new Error('Project not found'))
    renderDashboard('DOESNOTEXIST')
    await waitFor(() => screen.getByText('Project not found'))
    expect(screen.getByText('Project not found')).toBeInTheDocument()
  })

  it('offers a back button on the not-found screen', async () => {
    mockAuth()
    vi.spyOn(api, 'getProjectById').mockRejectedValue(new Error('Not found'))
    renderDashboard('DOESNOTEXIST')
    await waitFor(() => screen.getByText('Back to Projects'))
    await userEvent.click(screen.getByText('Back to Projects'))
    expect(mockNavigate).toHaveBeenCalledWith('/projects')
  })
})

// ---------------------------------------------------------------------------
// Optional fields absent (nulls)
// ---------------------------------------------------------------------------

describe('ProjectDashboard with optional fields null', () => {
  it('does not crash when registration_code and project_description are null', async () => {
    mockAuth()
    vi.spyOn(api, 'getProjectById').mockResolvedValue({
      project_id: 'P002',
      project_name: 'Queens Plaza',
      project_description: null,
      registration_code: null,
      borough: 'Queens',
      status: 'active',
    })
    renderDashboard('P002')
    await waitFor(() => screen.getByText('P002'))
    expect(screen.getByText('P002')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------

describe('ProjectDashboard sign out', () => {
  it('calls signOut and navigates to /login', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    mockAuth({ signOut })
    vi.spyOn(api, 'getProjectById').mockResolvedValue(MOCK_PROJECT)
    renderDashboard()
    await waitFor(() => screen.getByText('Sign Out'))
    await userEvent.click(screen.getByText('Sign Out'))
    expect(signOut).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })
})
