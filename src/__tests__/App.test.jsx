import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import * as api from '../services/api'

vi.mock('../services/api', () => ({
  getProjectsForUser: vi.fn(),
  getProjectById: vi.fn(),
  getReport: vi.fn(),
  createReport: vi.fn(),
  saveGeneralForm: vi.fn(),
  listReports: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  api.getProjectsForUser.mockResolvedValue([])
  api.getProjectById.mockResolvedValue({ project_id: 'HWS0023', project_name: 'S/W Queens 2025' })
  api.listReports.mockResolvedValue([])
  api.getReport.mockReturnValue(new Promise(() => {})) // stay loading; only the URL matters here
})

async function signIn() {
  const user = userEvent.setup()
  await user.type(screen.getByPlaceholderText(/username/i), 'genghis')
  await user.type(screen.getByPlaceholderText(/password/i), 'x')
  await user.click(screen.getByRole('button', { name: /sign in/i }))
}

// ---------------------------------------------------------------------------
// Redirect back after login (refresh on a protected page lands on /login first)
// ---------------------------------------------------------------------------

describe('redirect back after login', () => {
  it('returns to the original page, query string included', async () => {
    window.history.pushState({}, '', '/project/HWS0023/report/general?report_id=abc-123')
    render(<App />)
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument()

    await signIn()

    await vi.waitFor(() =>
      expect(window.location.pathname + window.location.search)
        .toBe('/project/HWS0023/report/general?report_id=abc-123')
    )
  })

  it('goes to the project list when login was opened directly', async () => {
    window.history.pushState({}, '', '/login')
    render(<App />)

    await signIn()

    await vi.waitFor(() => expect(window.location.pathname).toBe('/projects'))
  })
})
