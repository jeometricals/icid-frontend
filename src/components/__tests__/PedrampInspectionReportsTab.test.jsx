import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import PedrampInspectionReportsTab from '../PedrampInspectionReportsTab'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

vi.mock('../../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  listPedRampInspections: vi.fn(), bulkDownloadPedRampInspections: vi.fn(), getInspectionDotPdf: vi.fn(),
  listUsers: vi.fn(), downloadFile: vi.fn(),
}))

const CORNER_ID = 'c0000000-0000-4000-8000-000000000001'
const INSPECTION_ID = 'e0000000-0000-4000-8000-000000000001'
const RE_ID = 'b0000000-0000-4000-8000-000000000003'
const ROW = {
  inspection_id: INSPECTION_ID, corner_id: CORNER_ID, corner_name: '3rd Ave & 38 Street', corner_direction: 'NE',
  ramp_count: 2, status: 'approved', inspector_uuid: 'x', inspector_name: 'Ada Inspector', re_uuid: RE_ID,
  re_name: 'Rhea Engineer', approved_at: '2026-10-21T15:00:00Z', tif_count: 1, has_dot_pdf: true,
}
const DRAFT_ROW = { ...ROW, inspection_id: 'e2', corner_id: 'c2', corner_name: '5th Ave & 9 Street', status: 'draft',
  re_uuid: null, re_name: null, approved_at: null, tif_count: 0, has_dot_pdf: false }
const listing = (rows, total = rows.length, page = 1) => ({ total, page, page_size: 30, rows })

function PageUrl() {
  const location = useLocation()
  return <div data-testid="url">{location.search}</div>
}

function renderTab(search = '?tab=ped-ramp', user = TEST_USER) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user })
  return render(
    <MemoryRouter initialEntries={[`/project/HWS0023/assessments${search}`]}>
      <Routes>
        <Route path="/project/:projectId/assessments" element={<><PageUrl /><PedrampInspectionReportsTab projectId="HWS0023" /></>} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
    </MemoryRouter>
  )
}

const url = () => new URLSearchParams(screen.getByTestId('url').textContent)
const lastQuery = () => api.listPedRampInspections.mock.calls.at(-1)[1]

beforeEach(() => {
  vi.clearAllMocks()
  api.listUsers.mockResolvedValue([
    { user_id: RE_ID, first_name: 'Rhea', last_name: 'Engineer' },
    { user_id: 'x', first_name: 'Ada', last_name: 'Inspector' },
  ])
})

describe('PedrampInspectionReportsTab', () => {
  it('lists the corners with a link to each inspection', async () => {
    api.listPedRampInspections.mockResolvedValue(listing([ROW, DRAFT_ROW]))
    renderTab()
    const table = await screen.findByRole('table', { name: 'Ped ramp inspections' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(within(rows[0]).getAllByRole('cell').map((td) => td.textContent)).toEqual([
      '3rd Ave & 38 Street (NE)', '2', 'Approved', 'Ada Inspector', 'Rhea Engineer', 'Oct 21', '1', 'Download',
    ])
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', `/project/HWS0023/ped-ramp-corners/${CORNER_ID}/inspection`)
    expect(within(rows[1]).queryByRole('button', { name: 'Download' })).not.toBeInTheDocument()
    expect(screen.getByText('2 corners · page 1 of 1')).toBeInTheDocument()
    expect(api.listPedRampInspections).toHaveBeenCalledWith('HWS0023', expect.objectContaining({ page: 1, pageSize: 30, status: '' }))
  })

  it('reads its filters off the URL and writes them back, keeping the tab and going back to page 1', async () => {
    const user = userEvent.setup()
    api.listPedRampInspections.mockResolvedValue(listing([ROW], 31))
    renderTab('?tab=ped-ramp&status=approved&has_tif=yes&page=2')
    await screen.findByRole('table')
    expect(lastQuery()).toMatchObject({ status: 'approved', hasTif: 'yes', page: 2 })
    expect(screen.getByLabelText('Status')).toHaveValue('approved')

    await screen.findAllByRole('option', { name: 'Rhea Engineer' })
    await user.selectOptions(screen.getByLabelText('RE'), RE_ID)
    await waitFor(() => expect(lastQuery()).toMatchObject({ reUuid: RE_ID, page: 1 }))
    expect(url().get('tab')).toBe('ped-ramp')
    expect(url().get('page')).toBeNull()

    await user.type(screen.getByLabelText('Approved from'), '2026-10-01')
    await waitFor(() => expect(lastQuery()).toMatchObject({ from: '2026-10-01' }))
  })

  it('searches 300 ms after typing stops', async () => {
    const user = userEvent.setup()
    api.listPedRampInspections.mockResolvedValue(listing([]))
    renderTab()
    await screen.findByText('No corner has an inspection yet.')
    await user.type(screen.getByLabelText('Search'), 'R1')
    await waitFor(() => expect(url().get('q')).toBe('R1'))
    await waitFor(() => expect(lastQuery()).toMatchObject({ q: 'R1' }))
    expect(await screen.findByText('No inspections match these filters.')).toBeInTheDocument()
  })

  it('pages 30 at a time', async () => {
    const user = userEvent.setup()
    api.listPedRampInspections.mockResolvedValue(listing([ROW], 61))
    renderTab()
    expect(await screen.findByText('61 corners · page 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 2 }))
    expect(url().get('page')).toBe('2')
  })

  it("downloads one corner's DOT PDF, and says why it can't", async () => {
    const user = userEvent.setup()
    api.listPedRampInspections.mockResolvedValue(listing([ROW]))
    api.getInspectionDotPdf.mockResolvedValueOnce({ url: 'https://s/p.pdf', expires_at: 'x', file_name: '3rd.pdf' })
      .mockRejectedValueOnce(new Error('No DOT PDF stored for this inspection'))
    renderTab()
    await user.click(await screen.findByRole('button', { name: 'Download' }))
    await waitFor(() => expect(api.downloadFile).toHaveBeenCalledWith('https://s/p.pdf', '3rd.pdf'))
    expect(api.getInspectionDotPdf).toHaveBeenCalledWith(INSPECTION_ID)
    await user.click(screen.getByRole('button', { name: 'Download' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No DOT PDF stored for this inspection')
  })

  it('downloads all under the filters, and shows the backend refusal', async () => {
    const user = userEvent.setup()
    api.listPedRampInspections.mockResolvedValue(listing([ROW]))
    api.bulkDownloadPedRampInspections
      .mockResolvedValueOnce({ url: 'https://s/z.zip', expires_at: 'x', corner_count: 3, file_name: 'HWS0023.zip' })
      .mockRejectedValueOnce(new Error('More than 100 corners match: narrow the filters to download at most 100'))
    renderTab('?tab=ped-ramp&has_tif=no')
    await user.click(await screen.findByRole('button', { name: 'Download all (zip)' }))
    await waitFor(() => expect(api.downloadFile).toHaveBeenCalledWith('https://s/z.zip', 'HWS0023.zip'))
    expect(api.bulkDownloadPedRampInspections).toHaveBeenCalledWith('HWS0023', expect.objectContaining({ hasTif: 'no' }))
    expect(screen.getByText('3 corners in HWS0023.zip')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Download all (zip)' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('narrow the filters')
  })

  it("shows the backend's refusal of a bad filter, with Retry and Clear filters", async () => {
    const user = userEvent.setup()
    api.listPedRampInspections.mockRejectedValueOnce(new Error('from cannot be after to')).mockResolvedValue(listing([]))
    renderTab('?tab=ped-ramp&from=2026-10-31&to=2026-10-01')
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the inspections: from cannot be after to")
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(url().toString()).toBe('tab=ped-ramp'))
    expect(await screen.findByText('No corner has an inspection yet.')).toBeInTheDocument()
  })

  it('leaves out the inspector and RE filters for a demo user', async () => {
    api.listPedRampInspections.mockResolvedValue(listing([]))
    renderTab('?tab=ped-ramp', DEMO_USER)
    await screen.findByText('No corner has an inspection yet.')
    expect(screen.queryByLabelText('RE')).not.toBeInTheDocument()
    expect(api.listUsers).not.toHaveBeenCalled()
  })
})
