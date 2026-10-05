import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import ProtectedRoute from '../ProtectedRoute'
import * as AuthContext from '../../contexts/AuthContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

function LoginStub() {
  const location = useLocation()
  const from = location.state?.from
  return <div>login page, from {from ? `${from.pathname}${from.search}` : 'nowhere'}</div>
}

function mockAuth(value) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: null, isLoading: false, ...value })
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginStub />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/projects" element={<div>the project list</div>} />
          <Route path="/project/:projectId" element={<div>a project</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('ProtectedRoute', () => {
  it('shows a spinner, and neither the page nor a redirect, while the session is being restored', () => {
    mockAuth({ isLoading: true })
    renderAt('/projects')
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('the project list')).not.toBeInTheDocument()
    expect(screen.queryByText(/login page/)).not.toBeInTheDocument()
  })

  it('redirects to /login when nobody is signed in, remembering the page asked for', () => {
    mockAuth({ user: null })
    renderAt('/project/HWS0023?tab=pay')
    expect(screen.getByText('login page, from /project/HWS0023?tab=pay')).toBeInTheDocument()
    expect(screen.queryByText('a project')).not.toBeInTheDocument()
  })

  it.each([['a regular user', TEST_USER], ['a demo user', DEMO_USER]])('renders the nested route for %s', (_, user) => {
    mockAuth({ user })
    renderAt('/projects')
    expect(screen.getByText('the project list')).toBeInTheDocument()
  })

  it('renders its children when used as a wrapper', () => {
    mockAuth({ user: TEST_USER })
    render(
      <MemoryRouter>
        <ProtectedRoute><div>wrapped page</div></ProtectedRoute>
      </MemoryRouter>
    )
    expect(screen.getByText('wrapped page')).toBeInTheDocument()
  })
})
