import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import * as api from '../services/api'
import { MOCK_CONTRACT_ITEMS } from '../test/contractItems'

vi.mock('../services/api', () => ({
  getContractItems: vi.fn(),
  getProjectsForUser: vi.fn(),
  getProjectById: vi.fn(),
  getIdr: vi.fn(),
  listIdrs: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  api.getProjectsForUser.mockResolvedValue([])
  api.getProjectById.mockResolvedValue({ project_id: 'HWS0023', project_name: 'S/W Queens 2025' })
  api.getContractItems.mockResolvedValue(MOCK_CONTRACT_ITEMS)
  api.listIdrs.mockResolvedValue([])
  api.getIdr.mockReturnValue(new Promise(() => {})) // stay loading; only the URL matters here
})

async function signIn() {
  const user = userEvent.setup()
  await user.type(screen.getByPlaceholderText(/username/i), 'genghis')
  await user.type(screen.getByPlaceholderText(/password/i), 'x')
  await user.click(screen.getByRole('button', { name: /sign in/i }))
}

// ---------------------------------------------------------------------------
// Legacy report URLs
// ---------------------------------------------------------------------------

describe('legacy /report/ URLs', () => {
  it('redirect to the General page for the same project, IDR and report', async () => {
    window.history.pushState({}, '', '/project/HWS0023/idr/idr-1/report/rep-xyz')
    render(<App />)
    await signIn()

    await vi.waitFor(() => expect(window.location.pathname).toBe('/project/HWS0023/idr/idr-1/general/rep-xyz'))
  })
})

// ---------------------------------------------------------------------------
// Redirect back after login (refresh on a protected page lands on /login first)
// ---------------------------------------------------------------------------

describe('redirect back after login', () => {
  it('returns to the original page, query string included', async () => {
    window.history.pushState({}, '', '/project/HWS0023/idr/idr-1/general/rep-1?tab=pay')
    render(<App />)
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument()

    await signIn()

    await vi.waitFor(() =>
      expect(window.location.pathname + window.location.search)
        .toBe('/project/HWS0023/idr/idr-1/general/rep-1?tab=pay')
    )
  })

  it('goes to the project list when login was opened directly', async () => {
    window.history.pushState({}, '', '/login')
    render(<App />)

    await signIn()

    await vi.waitFor(() => expect(window.location.pathname).toBe('/projects'))
  })
})
