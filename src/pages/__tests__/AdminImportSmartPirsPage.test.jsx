import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AdminImportSmartPirsPage, { NOT_ADMIN_TEXT } from '../AdminImportSmartPirsPage'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

vi.mock('../../services/api', () => ({ importSmartPir: vi.fn() }))

const ADMIN = { ...TEST_USER, role: 'admin' }

function CurrentUrl() {
  return <div data-testid="url">{useLocation().pathname}</div>
}

function renderPage(user = ADMIN) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user })
  return render(
    <MemoryRouter initialEntries={['/admin/import-smart-pirs']}>
      <Routes>
        <Route path="/admin/import-smart-pirs" element={<AdminImportSmartPirsPage />} />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AdminImportSmartPirsPage', () => {
  it('gives an admin the import: a PIR id, a file and Import', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Import Smart PIRs (Admin)' })).toBeInTheDocument()
    expect(screen.getByLabelText('PIR id')).toBeInTheDocument()
    expect(screen.getByLabelText('Smart PIR file (.json)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
  })

  it.each([
    ['a project member', TEST_USER],
    ['a demo user', DEMO_USER],
  ])('tells %s it is for admins, with no import', (_, user) => {
    renderPage(user)
    expect(screen.getByText(NOT_ADMIN_TEXT)).toBeInTheDocument()
    expect(screen.queryByLabelText('PIR id')).not.toBeInTheDocument()
    expect(api.importSmartPir).not.toHaveBeenCalled()
  })

  it('goes back to the projects', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Back to Projects' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/projects')
  })
})
