import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaxMapPdfLine, { NO_PDF } from '../TaxMapPdfLine'
import * as api from '../../services/api'

vi.mock('../../services/api', () => ({ getTaxMapPdf: vi.fn(), refreshTaxMapPdf: vi.fn(), uploadTaxMapPdf: vi.fn() }))

const MAP_ID = '30070020130725102158'
const NONE = { id: 'site-1', boro: 'Brooklyn', block: '700', has_tax_map_pdf: false, tax_map_pdf_source: null }
const FETCHED = { ...NONE, has_tax_map_pdf: true, tax_map_pdf_source: 'dof_map_library', tax_map_pdf_map_id: MAP_ID,
  tax_map_pdf_effective_date: '2013-07-25', tax_map_pdf_fetched_at: '2026-11-05T14:00:00Z' }
const UPLOADED = { ...NONE, has_tax_map_pdf: true, tax_map_pdf_source: 'upload', tax_map_pdf_map_id: null,
  tax_map_pdf_effective_date: null, tax_map_pdf_fetched_at: '2026-11-06T09:00:00Z' }

beforeEach(() => { vi.clearAllMocks() })

describe('TaxMapPdfLine', () => {
  it('reads none without a PDF', () => {
    render(<TaxMapPdfLine property={NONE} admin={false} onChanged={vi.fn()} />)
    expect(screen.getByText(NO_PDF)).toBeInTheDocument()
    expect(screen.queryByText('View')).not.toBeInTheDocument()
  })

  it("names DOF's map by its block and effective date, View opening DOF's page of it", () => {
    render(<TaxMapPdfLine property={FETCHED} admin={false} onChanged={vi.fn()} />)
    expect(screen.getByText('Brooklyn block 700 · effective 2013-07-25')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute(
      'href', `https://propertyinformationportal.nyc.gov/pdf/home/index/map_library/${MAP_ID}`)
  })

  it('opens an upload through a fresh signed URL', async () => {
    api.getTaxMapPdf.mockResolvedValue({ url: 'https://signed/pdf' })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<TaxMapPdfLine property={UPLOADED} admin={false} onChanged={vi.fn()} />)
    expect(screen.getByText('Uploaded 2026-11-06')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'View' }))
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://signed/pdf', '_blank', 'noopener'))
    open.mockRestore()
  })

  it('gives only an admin Refresh and Upload', () => {
    render(<TaxMapPdfLine property={FETCHED} admin={false} onChanged={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument()
  })

  it("refreshes from DOF and hands on what was stored", async () => {
    const stored = { source: 'dof_map_library', map_id: MAP_ID, effective_date: '2013-07-25' }
    api.refreshTaxMapPdf.mockResolvedValue(stored)
    const onChanged = vi.fn()
    render(<TaxMapPdfLine property={NONE} admin onChanged={onChanged} />)
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(stored))
    expect(api.refreshTaxMapPdf).toHaveBeenCalledWith('site-1')
  })

  it("shows DOF being down in the backend's words", async () => {
    api.refreshTaxMapPdf.mockRejectedValue(new Error("DOF's tax map service can't be reached right now; nothing was changed."))
    render(<TaxMapPdfLine property={NONE} admin onChanged={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("DOF's tax map service can't be reached")
  })

  it('uploads a PDF the admin picks', async () => {
    const stored = { source: 'upload', map_id: null }
    api.uploadTaxMapPdf.mockResolvedValue(stored)
    const onChanged = vi.fn()
    render(<TaxMapPdfLine property={NONE} admin onChanged={onChanged} />)
    const file = new File(['%PDF-1.7'], 'block-700.pdf', { type: 'application/pdf' })
    await userEvent.upload(screen.getByLabelText('Tax map PDF file'), file)
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(stored))
    expect(api.uploadTaxMapPdf).toHaveBeenCalledWith('site-1', file)
  })

  it("refuses a file that isn't a PDF before sending it", async () => {
    render(<TaxMapPdfLine property={NONE} admin onChanged={vi.fn()} />)
    const input = screen.getByLabelText('Tax map PDF file')
    await userEvent.upload(input, new File(['x'], 'map.png', { type: 'image/png' }), { applyAccept: false })
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a PDF.')
    expect(api.uploadTaxMapPdf).not.toHaveBeenCalled()
  })
})
