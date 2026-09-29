import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AddendumsSection from '../AddendumsSection'
import * as api from '../../../services/api'

vi.mock('../../../services/api', () => ({
  addReport: vi.fn(),
  deleteReport: vi.fn(),
}))

const REPORT_ID = 'rep-swcb'
const PAGE_URL = `/project/HWS0023/idr/idr-1/swcb/${REPORT_ID}`

const main = { report_id: REPORT_ID, report_type: 'SWCB', is_addendum: false, parent_report_id: null }
const mix = { report_id: 'rep-mix', report_type: 'CONC_MIX', is_addendum: true, parent_report_id: REPORT_ID }
const cylinders = { report_id: 'rep-cyl', report_type: 'CONC_CYL', is_addendum: true, parent_report_id: REPORT_ID }
const otherParentsMix = { report_id: 'rep-other', report_type: 'CONC_MIX', is_addendum: true, parent_report_id: 'rep-gen' }

function CurrentUrl() {
  const location = useLocation()
  return (
    <>
      <div data-testid="url">{location.pathname}</div>
      <div data-testid="from">{location.state?.from}</div>
    </>
  )
}

function renderSection(props = {}) {
  const onChanged = vi.fn()
  render(
    <MemoryRouter initialEntries={[{ pathname: PAGE_URL, state: { from: 'drafts' } }]}>
      <Routes>
        <Route
          path="/project/:projectId/idr/:idrId/swcb/:reportId"
          element={
            <AddendumsSection projectId="HWS0023" idrId="idr-1" reportId={REPORT_ID}
              reports={[main, mix, cylinders, otherParentsMix]} onChanged={onChanged} {...props} />
          }
        />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
  return onChanged
}

const rows = () => within(screen.getByRole('list')).getAllByRole('listitem')

beforeEach(() => {
  vi.clearAllMocks()
  api.addReport.mockResolvedValue({ report_id: 'rep-new', report_type: 'CONC_MIX', is_addendum: true, parent_report_id: REPORT_ID })
  api.deleteReport.mockResolvedValue()
})

describe('AddendumsSection — list', () => {
  it("lists only this report's addendums, by type name", () => {
    renderSection()
    expect(screen.getByRole('heading', { name: 'Addendums' })).toBeInTheDocument()
    expect(rows().map(r => r.textContent)).toEqual([
      expect.stringContaining('Concrete Truck & Mix Info'),
      expect.stringContaining('Concrete Cylinder Data'),
    ])
  })

  it('shows an empty state when the report has no addendums', () => {
    renderSection({ reports: [main, otherParentsMix] })
    expect(screen.getByText('No addendums yet.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it("opens an addendum at its type's page, keeping where the IDR was opened from", async () => {
    renderSection()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open Concrete Truck & Mix Info' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/project/HWS0023/idr/idr-1/conc-mix/rep-mix')
    expect(screen.getByTestId('from')).toHaveTextContent('drafts')
  })

  it("disables Open for an addendum type whose page isn't built yet", () => {
    const sketch = { report_id: 'rep-sketch', report_type: 'SKETCH', is_addendum: true, parent_report_id: REPORT_ID }
    renderSection({ reports: [main, mix, cylinders, sketch] })
    expect(screen.getByRole('button', { name: 'Open Sketch Sheet' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Open Concrete Cylinder Data' })).toBeEnabled()
  })
})

describe('AddendumsSection — add', () => {
  it('offers only addendum types that have a page', async () => {
    renderSection()
    await userEvent.setup().click(screen.getByRole('button', { name: /add addendum/i }))
    const picker = screen.getByRole('group', { name: 'Addendum types' })
    expect(within(picker).getAllByRole('button').map(b => b.textContent))
      .toEqual(['Concrete Truck & Mix Info', 'Concrete Cylinder Data'])
  })

  it('adds the picked type as an addendum of this report, then opens it', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.click(screen.getByRole('button', { name: /add addendum/i }))
    await user.click(screen.getByRole('button', { name: 'Concrete Truck & Mix Info' }))
    expect(api.addReport).toHaveBeenCalledWith('idr-1', { reportType: 'CONC_MIX', isAddendum: true, parentReportId: REPORT_ID })
    expect(await screen.findByTestId('url')).toHaveTextContent('/project/HWS0023/idr/idr-1/conc-mix/rep-new')
    expect(screen.getByTestId('from')).toHaveTextContent('drafts')
  })

  it('shows an error and stays put when adding fails', async () => {
    api.addReport.mockRejectedValueOnce(new Error('Only draft IDRs can be edited'))
    const user = userEvent.setup()
    renderSection()
    await user.click(screen.getByRole('button', { name: /add addendum/i }))
    await user.click(screen.getByRole('button', { name: 'Concrete Truck & Mix Info' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't add addendum: Only draft IDRs can be edited")
    expect(screen.queryByTestId('url')).not.toBeInTheDocument()
  })
})

describe('AddendumsSection — saving the parent before leaving', () => {
  // Stands in for useReportForm's navigateSafely: records the parent save, then runs the navigation (or not)
  const safeNav = (order, saveSucceeds = true) => vi.fn(async (action) => {
    order.push('save parent')
    if (saveSucceeds) await action()
  })

  it('Add saves the parent first, then creates the addendum and opens it', async () => {
    const order = []
    api.addReport.mockImplementation(async () => {
      order.push('create addendum')
      return { report_id: 'rep-new', report_type: 'CONC_MIX', is_addendum: true, parent_report_id: REPORT_ID }
    })
    const user = userEvent.setup()
    renderSection({ navigateSafely: safeNav(order) })
    await user.click(screen.getByRole('button', { name: /add addendum/i }))
    await user.click(screen.getByRole('button', { name: 'Concrete Truck & Mix Info' }))

    expect(order).toEqual(['save parent', 'create addendum'])
    expect(await screen.findByTestId('url')).toHaveTextContent('/project/HWS0023/idr/idr-1/conc-mix/rep-new')
  })

  it('Add creates nothing and stays put when the parent save fails', async () => {
    const order = []
    const user = userEvent.setup()
    renderSection({ navigateSafely: safeNav(order, false) })
    await user.click(screen.getByRole('button', { name: /add addendum/i }))
    await user.click(screen.getByRole('button', { name: 'Concrete Truck & Mix Info' }))

    expect(order).toEqual(['save parent'])
    expect(api.addReport).not.toHaveBeenCalled()
    expect(screen.queryByTestId('url')).not.toBeInTheDocument()
    // The picker is usable again for a retry once the save error is dealt with
    expect(screen.getByRole('button', { name: 'Concrete Truck & Mix Info' })).toBeEnabled()
  })

  it('Open saves the parent first, and stays put when that save fails', async () => {
    const user = userEvent.setup()
    const failing = safeNav([], false)
    renderSection({ navigateSafely: failing })
    await user.click(screen.getByRole('button', { name: 'Open Concrete Truck & Mix Info' }))
    expect(failing).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('url')).not.toBeInTheDocument()
  })

  it('Open navigates once the parent save succeeds', async () => {
    const order = []
    renderSection({ navigateSafely: safeNav(order) })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open Concrete Truck & Mix Info' }))
    expect(order).toEqual(['save parent'])
    expect(screen.getByTestId('url')).toHaveTextContent('/project/HWS0023/idr/idr-1/conc-mix/rep-mix')
  })
})

describe('AddendumsSection — delete', () => {
  it('asks for confirmation, then deletes the addendum and refetches the IDR', async () => {
    const user = userEvent.setup()
    const onChanged = renderSection()
    await user.click(screen.getByRole('button', { name: 'Delete Concrete Truck & Mix Info' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete addendum' })
    expect(dialog).toHaveTextContent('Delete this Concrete Truck & Mix Info addendum? This cannot be undone.')
    await user.click(within(dialog).getByRole('button', { name: 'Yes' }))

    expect(api.deleteReport).toHaveBeenCalledWith('idr-1', 'rep-mix')
    expect(onChanged).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does nothing on No', async () => {
    const user = userEvent.setup()
    const onChanged = renderSection()
    await user.click(screen.getByRole('button', { name: 'Delete Concrete Truck & Mix Info' }))
    await user.click(screen.getByRole('button', { name: 'No' }))
    expect(api.deleteReport).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the dialog open with the error when the delete fails', async () => {
    api.deleteReport.mockRejectedValueOnce(new Error('Report not found in this IDR'))
    const user = userEvent.setup()
    const onChanged = renderSection()
    await user.click(screen.getByRole('button', { name: 'Delete Concrete Truck & Mix Info' }))
    await user.click(screen.getByRole('button', { name: 'Yes' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete addendum' })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("Couldn't delete addendum: Report not found in this IDR")
    expect(onChanged).not.toHaveBeenCalled()
  })
})

describe('AddendumsSection — disabled', () => {
  it('hides Add and Delete but keeps Open', () => {
    renderSection({ disabled: true })
    expect(screen.queryByRole('button', { name: /add addendum/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Concrete Truck & Mix Info' })).toBeEnabled()
  })
})
