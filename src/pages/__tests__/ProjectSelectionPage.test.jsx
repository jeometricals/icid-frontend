import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ProjectSelectionPage from '../ProjectSelectionPage'
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

const MOCK_PROJECTS = [
  { project_id: 'HWS0023', project_name: 'Curb & Sidewalk', borough: 'Queens', status: 'active', user_role: 'inspector' },
  { project_id: 'SE384',   project_name: 'Sewer Rehab',     borough: 'Brooklyn', status: 'active', user_role: 'inspector' },
]

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

function renderPage() {
  return render(
    <MemoryRouter>
      <ProjectSelectionPage />
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

describe('ProjectSelectionPage loading', () => {
  it('shows a spinner while projects are being fetched', () => {
    mockAuth()
    vi.spyOn(api, 'getProjectsForUser').mockReturnValue(new Promise(() => {})) // never resolves
    renderPage()
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Successful fetch
// ---------------------------------------------------------------------------

describe('ProjectSelectionPage with projects', () => {
  beforeEach(() => {
    mockAuth()
    vi.spyOn(api, 'getProjectsForUser').mockResolvedValue(MOCK_PROJECTS)
  })

  it('renders the page heading', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Pick A Project'))
    expect(screen.getByText('Pick A Project')).toBeInTheDocument()
  })

  it('renders all fetched projects', async () => {
    renderPage()
    await waitFor(() => screen.getByText('HWS0023'))
    expect(screen.getByText('HWS0023')).toBeInTheDocument()
    expect(screen.getByText('SE384')).toBeInTheDocument()
  })

  it('shows project name and borough for each project', async () => {
    renderPage()
    await waitFor(() => screen.getByText('HWS0023'))
    expect(screen.getByText('Curb & Sidewalk')).toBeInTheDocument()
    expect(screen.getByText('Queens')).toBeInTheDocument()
  })

  it('calls getProjectsForUser with the dev user id', async () => {
    renderPage()
    await waitFor(() => expect(api.getProjectsForUser).toHaveBeenCalledWith(28))
  })

  it('navigates to the project dashboard when a project is clicked', async () => {
    renderPage()
    await waitFor(() => screen.getByText('HWS0023'))
    await userEvent.click(screen.getByText('HWS0023').closest('button'))
    expect(mockNavigate).toHaveBeenCalledWith('/project/HWS0023')
  })

  it('shows the signed-in user name in the header', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Genghis Khan'))
    expect(screen.getByText('Genghis Khan')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Empty project list
// ---------------------------------------------------------------------------

describe('ProjectSelectionPage with no projects', () => {
  it('shows an empty-state message', async () => {
    mockAuth()
    vi.spyOn(api, 'getProjectsForUser').mockResolvedValue([])
    renderPage()
    await waitFor(() => screen.getByText(/no projects assigned/i))
    expect(screen.getByText(/no projects assigned/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Fetch error
// ---------------------------------------------------------------------------

describe('ProjectSelectionPage fetch error', () => {
  it('shows an error banner when the API call fails', async () => {
    mockAuth()
    vi.spyOn(api, 'getProjectsForUser').mockRejectedValue(new Error('Internal Server Error'))
    renderPage()
    await waitFor(() => screen.getByText(/failed to load projects/i))
    expect(screen.getByText(/failed to load projects/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------

describe('ProjectSelectionPage sign out', () => {
  it('calls signOut and navigates to /login', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    mockAuth({ signOut })
    vi.spyOn(api, 'getProjectsForUser').mockResolvedValue(MOCK_PROJECTS)
    renderPage()
    await waitFor(() => screen.getByText('HWS0023'))
    await userEvent.click(screen.getByText('Sign Out'))
    expect(signOut).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })
})
