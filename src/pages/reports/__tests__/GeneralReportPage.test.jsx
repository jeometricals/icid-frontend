import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { format } from 'date-fns'
import GeneralReportPage from '../GeneralReportPage'
import * as api from '../../../services/api'
import * as AuthContext from '../../../contexts/AuthContext'

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const DEV_USER = {
  id: '327d3ed2-a3d6-4235-9408-7fe721b12bed',
  email: 'KhanG@magnoleng.pc',
  user_metadata: { full_name: 'Genghis Khan' }
}

const REPORT_ID = '9b1c2f3e-0000-4000-8000-000000000001'
const SAVED_AT = '2026-09-23T14:05:00Z'
const SAVED_TEXT = `Saved at ${format(new Date(SAVED_AT), 'HH:mm')}`

vi.mock('../../../services/api', () => ({
  createReport: vi.fn(),
  saveGeneralForm: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: DEV_USER })
  api.createReport.mockResolvedValue({ report_id: REPORT_ID, status: 'draft' })
  api.saveGeneralForm.mockResolvedValue({ report_id: REPORT_ID, completed_form_id: 'cf-1', saved_at: SAVED_AT })
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/project/HWS0023/report/general']}>
      <Routes>
        <Route path="/project/:projectId/report/general" element={<GeneralReportPage />} />
      </Routes>
    </MemoryRouter>
  )
}

// The page has two Save Draft buttons (sticky header + footer); both share one handler.
const saveButton = () => screen.getAllByRole('button', { name: /save draft|saving/i })[0]
const descriptionBox = () => screen.getByPlaceholderText(/detailed description of work/i)

// ---------------------------------------------------------------------------
// Save flow
// ---------------------------------------------------------------------------

describe('Save Draft', () => {
  it('first save creates the report then saves the form to it', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(descriptionBox(), 'Poured curb')
    await user.click(saveButton())

    await screen.findByText(SAVED_TEXT)
    expect(api.createReport).toHaveBeenCalledWith({
      projectId: 'HWS0023',
      reporterUuid: DEV_USER.id,
      reportDate: format(new Date(), 'yyyy-MM-dd'),
    })
    expect(api.saveGeneralForm).toHaveBeenCalledWith(
      REPORT_ID,
      expect.objectContaining({ description: 'Poured curb' })
    )
  })

  it('later saves reuse the report id without creating another report', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(saveButton())
    await screen.findByText(SAVED_TEXT)
    await user.type(descriptionBox(), 'More work')
    await user.click(saveButton())

    await waitFor(() => expect(api.saveGeneralForm).toHaveBeenCalledTimes(2))
    expect(api.createReport).toHaveBeenCalledTimes(1)
    expect(api.saveGeneralForm).toHaveBeenLastCalledWith(REPORT_ID, expect.objectContaining({ description: 'More work' }))
  })

  it('shows Saving... and disables both buttons while the request is in flight', async () => {
    let finishSave
    api.saveGeneralForm.mockReturnValue(new Promise(resolve => { finishSave = resolve }))
    const user = userEvent.setup()
    renderPage()
    await user.click(saveButton())

    const busy = await screen.findAllByRole('button', { name: /saving/i })
    expect(busy).toHaveLength(2)
    busy.forEach(button => expect(button).toBeDisabled())

    finishSave({ report_id: REPORT_ID, completed_form_id: 'cf-1', saved_at: SAVED_AT })
    await screen.findByText(SAVED_TEXT)
    expect(saveButton()).toBeEnabled()
  })

  it('shows the backend error and keeps the typed form data', async () => {
    api.saveGeneralForm.mockRejectedValue(new Error('Only draft reports can be edited'))
    const user = userEvent.setup()
    renderPage()
    await user.type(descriptionBox(), 'Do not lose me')
    await user.click(saveButton())

    expect(await screen.findByText(/save failed: only draft reports can be edited/i)).toBeInTheDocument()
    expect(descriptionBox()).toHaveValue('Do not lose me')
  })

  it('retry after a failed form save reuses the created report', async () => {
    api.saveGeneralForm.mockRejectedValueOnce(new Error('Network error'))
    const user = userEvent.setup()
    renderPage()
    await user.click(saveButton())
    await screen.findByText(/save failed: network error/i)

    await user.click(saveButton())
    await screen.findByText(SAVED_TEXT)
    expect(api.createReport).toHaveBeenCalledTimes(1)
    expect(api.saveGeneralForm).toHaveBeenCalledTimes(2)
    expect(api.saveGeneralForm).toHaveBeenLastCalledWith(REPORT_ID, expect.any(Object))
    expect(screen.queryByText(/save failed/i)).not.toBeInTheDocument()
  })

  it('retry after a failed create tries creating the report again', async () => {
    api.createReport.mockRejectedValueOnce(new Error('Reporter is not assigned to this project'))
    const user = userEvent.setup()
    renderPage()
    await user.click(saveButton())
    await screen.findByText(/save failed: reporter is not assigned/i)
    expect(api.saveGeneralForm).not.toHaveBeenCalled()

    await user.click(saveButton())
    await screen.findByText(SAVED_TEXT)
    expect(api.createReport).toHaveBeenCalledTimes(2)
  })

  it('saves pay item rows typed into the table', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /add item/i }))
    await user.type(screen.getByPlaceholderText('Item No.'), '4.01')
    await user.type(screen.getByPlaceholderText('Qty'), '12')
    await user.click(saveButton())

    await waitFor(() => expect(api.saveGeneralForm).toHaveBeenCalled())
    expect(api.saveGeneralForm.mock.calls[0][1].payItems).toEqual([
      { itemNo: '4.01', budgetCode: '', payQuantity: '12', quantityChk: '', description: '' },
    ])
  })
})

// ---------------------------------------------------------------------------
// Unsaved changes
// ---------------------------------------------------------------------------

describe('unsaved changes', () => {
  it('shows after an edit and clears only when create + save both succeed', async () => {
    api.saveGeneralForm.mockRejectedValueOnce(new Error('Network error'))
    const user = userEvent.setup()
    renderPage()
    await user.type(descriptionBox(), 'x')
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()

    // Report created, form save failed: still dirty (error shown instead)
    await user.click(saveButton())
    await screen.findByText(/save failed/i)

    await user.click(saveButton())
    await screen.findByText(SAVED_TEXT)
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
  })

  it('comes back after editing a saved form', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(saveButton())
    await screen.findByText(SAVED_TEXT)

    await user.type(descriptionBox(), 'y')
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
  })

  it('stays set when the form is edited while a save is in flight', async () => {
    let finishSave
    api.saveGeneralForm.mockReturnValue(new Promise(resolve => { finishSave = resolve }))
    const user = userEvent.setup()
    renderPage()
    await user.click(saveButton())
    await screen.findAllByRole('button', { name: /saving/i })
    await user.type(descriptionBox(), 'typed mid-save')

    finishSave({ report_id: REPORT_ID, completed_form_id: 'cf-1', saved_at: SAVED_AT })
    expect(await screen.findByText(/unsaved changes/i)).toBeInTheDocument()
  })
})
