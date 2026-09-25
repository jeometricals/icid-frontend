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
  id: '327d3ed2-a3d6-4235-9408-7fe721b12bed',
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

  it('renders the legacy report type cards, without General (General reports live inside an IDR)', async () => {
    renderDashboard()
    await waitFor(() => screen.getByText('Daily Site Patrol'))
    expect(screen.getByText(/Curb, Sidewalk/)).toBeInTheDocument()
    expect(screen.queryByText('General')).not.toBeInTheDocument()
  })

  it('navigates to the correct report path when a report card is clicked', async () => {
    renderDashboard()
    await waitFor(() => screen.getByText('Daily Site Patrol'))
    await userEvent.click(screen.getByText('Daily Site Patrol').closest('button'))
    expect(mockNavigate).toHaveBeenCalledWith('/project/HWS0023/report/daily-patrol')
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

// Mimics apiFetch: HTTP errors carry .status, network errors don't
function apiError(message, status) {
  const err = new Error(message)
  if (status) err.status = status
  return err
}

describe('ProjectDashboard project not found', () => {
  it('shows the not-found message on a 404', async () => {
    mockAuth()
    vi.spyOn(api, 'getProjectById').mockRejectedValue(apiError('Project not found', 404))
    renderDashboard('DOESNOTEXIST')
    await waitFor(() => screen.getByText('Project not found'))
    expect(screen.getByText('Project not found')).toBeInTheDocument()
  })

  it('offers a back button on the not-found screen', async () => {
    mockAuth()
    vi.spyOn(api, 'getProjectById').mockRejectedValue(apiError('Not found', 404))
    renderDashboard('DOESNOTEXIST')
    await waitFor(() => screen.getByText('Back to Projects'))
    await userEvent.click(screen.getByText('Back to Projects'))
    expect(mockNavigate).toHaveBeenCalledWith('/projects')
  })
})

// ---------------------------------------------------------------------------
// Load failures other than not-found
// ---------------------------------------------------------------------------

describe('ProjectDashboard load failure', () => {
  it('shows the server error (not "not found") on a 500, and Retry loads again', async () => {
    mockAuth()
    vi.spyOn(api, 'getProjectById')
      .mockRejectedValueOnce(apiError('Internal Server Error', 500))
      .mockResolvedValueOnce(MOCK_PROJECT)
    renderDashboard()
    expect(await screen.findByText("Couldn't load this project")).toBeInTheDocument()
    expect(screen.getByText('Internal Server Error')).toBeInTheDocument()
    expect(screen.queryByText('Project not found')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText(MOCK_PROJECT.project_name)).toBeInTheDocument()
  })

  it('shows a network failure as a load error, not "not found"', async () => {
    mockAuth()
    vi.spyOn(api, 'getProjectById').mockRejectedValue(apiError('Failed to fetch'))
    renderDashboard()
    expect(await screen.findByText('Failed to fetch')).toBeInTheDocument()
    expect(screen.queryByText('Project not found')).not.toBeInTheDocument()
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

// ---------------------------------------------------------------------------
// Drafts entry point
// ---------------------------------------------------------------------------

describe('ProjectDashboard drafts button', () => {
  it("navigates to this project's drafts list", async () => {
    mockAuth()
    vi.spyOn(api, 'getProjectById').mockResolvedValue(MOCK_PROJECT)
    renderDashboard()
    await userEvent.click(await screen.findByRole('button', { name: 'Drafts' }))
    expect(mockNavigate).toHaveBeenCalledWith('/project/HWS0023/drafts')
  })
})

// ---------------------------------------------------------------------------
// Report Archive entry point
// ---------------------------------------------------------------------------

describe('ProjectDashboard report archive button', () => {
  it("navigates to this project's report archive", async () => {
    mockAuth()
    vi.spyOn(api, 'getProjectById').mockResolvedValue(MOCK_PROJECT)
    renderDashboard()
    await userEvent.click(await screen.findByRole('button', { name: 'Report Archive' }))
    expect(mockNavigate).toHaveBeenCalledWith('/project/HWS0023/archive')
  })
})
