import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AddDspButton from '../AddDspButton'
import * as api from '../../../services/api'

vi.mock('../../../services/api', () => ({
  addReport: vi.fn(),
}))

const PARENT_ID = 'rep-swcb'
const PAGE_URL = `/project/HWS0023/idr/idr-1/swcb/${PARENT_ID}`
const swcb = { report_id: PARENT_ID, report_type: 'SWCB', is_addendum: false, parent_report_id: null }
const dsp = { report_id: 'rep-dsp', report_type: 'DSP', is_addendum: true, parent_report_id: 'rep-gen' }

function CurrentUrl() {
  const location = useLocation()
  return (
    <>
      <div data-testid="url">{location.pathname}</div>
      <div data-testid="from">{location.state?.from}</div>
    </>
  )
}

function renderButton(props = {}) {
  render(
    <MemoryRouter initialEntries={[{ pathname: PAGE_URL, state: { from: 'archive' } }]}>
      <Routes>
        <Route
          path="/project/:projectId/idr/:idrId/swcb/:reportId"
          element={<AddDspButton projectId="HWS0023" idrId="idr-1" parentReportId={PARENT_ID} reports={[swcb]} {...props} />}
        />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
}

const addDsp = () => screen.getByRole('button', { name: 'Add DSP' })

beforeEach(() => {
  vi.clearAllMocks()
  api.addReport.mockResolvedValue({ report_id: 'rep-new-dsp', report_type: 'DSP', is_addendum: true, parent_report_id: PARENT_ID })
})

describe('AddDspButton', () => {
  it("adds the DSP as this report's addendum, then opens it, keeping where the IDR was opened from", async () => {
    renderButton()
    await userEvent.setup().click(addDsp())
    expect(api.addReport).toHaveBeenCalledWith('idr-1', { reportType: 'DSP', isAddendum: true, parentReportId: PARENT_ID })
    expect(await screen.findByTestId('url')).toHaveTextContent('/project/HWS0023/idr/idr-1/dsp/rep-new-dsp')
    expect(screen.getByTestId('from')).toHaveTextContent('archive')
  })

  it('is disabled, with its tooltip, once the IDR has a DSP', async () => {
    renderButton({ reports: [swcb, dsp] })
    expect(addDsp()).toBeDisabled()
    expect(addDsp()).toHaveAttribute('title', 'DSP already added to this IDR.')
    await userEvent.setup().click(addDsp())
    expect(api.addReport).not.toHaveBeenCalled()
  })

  it('has no tooltip while the IDR has no DSP', () => {
    renderButton()
    expect(addDsp()).toBeEnabled()
    expect(addDsp()).not.toHaveAttribute('title')
  })

  it("shows the backend's 409 as worded and stays put", async () => {
    api.addReport.mockRejectedValueOnce(new Error('This IDR already has a Daily Site Patrol'))
    renderButton()
    await userEvent.setup().click(addDsp())
    expect(await screen.findByRole('alert')).toHaveTextContent(/^This IDR already has a Daily Site Patrol$/)
    expect(screen.queryByTestId('url')).not.toBeInTheDocument()
  })

  it("shows the backend's 400 as worded", async () => {
    const message = 'A Daily Site Patrol is added to a General, SWCB, AC, Conc Mix or Conc Cyl report, as its addendum'
    api.addReport.mockRejectedValueOnce(new Error(message))
    renderButton()
    await userEvent.setup().click(addDsp())
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('saves the page first, and creates nothing when that save fails', async () => {
    const failing = vi.fn(async () => {})
    renderButton({ navigateSafely: failing })
    await userEvent.setup().click(addDsp())
    expect(failing).toHaveBeenCalledTimes(1)
    expect(api.addReport).not.toHaveBeenCalled()
    expect(screen.queryByTestId('url')).not.toBeInTheDocument()
  })
})
