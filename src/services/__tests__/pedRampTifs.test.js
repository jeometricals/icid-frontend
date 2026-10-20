import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  approveTif, deleteTif, downloadTifForm, draftTif, getTif, listInspectionTifs, updateTif,
} from '../pedRampTifs'
import { downloadInspectionDotForms } from '../pedRampInspections'
import { getInspectionReport } from '../pedRamps'
import * as exports from '../exports'
import { mockFetch, mockFetchNoContent, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const INSPECTION_ID = 'e0000000-0000-4000-8000-000000000001'
const RAMP_ID = 'c0000000-0000-4000-8000-000000000001'
const TIF_ID = 'f0000000-0000-4000-8000-000000000001'
const TIF = { id: TIF_ID, status: 'draft' }

describe('ped ramp TIFs', () => {
  it("lists an inspection's and drafts one for a ramp", async () => {
    mockFetch(200, { data: [TIF] })
    expect(await listInspectionTifs(INSPECTION_ID)).toEqual([TIF])
    expect(fetchUrl().pathname).toBe(`/v1/ped-ramp-inspections/${INSPECTION_ID}/tifs`)
    mockFetch(201, { data: TIF })
    await draftTif(INSPECTION_ID, RAMP_ID)
    expect(fetchUrl().pathname).toBe(`/v1/ped-ramp-inspections/${INSPECTION_ID}/ramps/${RAMP_ID}/tif`)
    expect(fetchInit().method).toBe('POST')
  })

  it('reads, changes, approves and deletes one', async () => {
    mockFetch(200, { data: TIF })
    await getTif(TIF_ID)
    expect(fetchUrl().pathname).toBe(`/v1/ped-ramp-tifs/${TIF_ID}`)
    mockFetch(200, { data: TIF })
    await updateTif(TIF_ID, { element_dws: true })
    expect(fetchInit().method).toBe('PATCH')
    expect(JSON.parse(fetchInit().body)).toEqual({ element_dws: true })
    mockFetch(200, { data: { ...TIF, status: 'approved' } })
    await approveTif(TIF_ID, { signer_name: 'Rita', signer_ny_license_no: 'PE-1' })
    expect(fetchUrl().pathname).toBe(`/v1/ped-ramp-tifs/${TIF_ID}/approve`)
    expect(JSON.parse(fetchInit().body)).toEqual({ signer_name: 'Rita', signer_ny_license_no: 'PE-1' })
    mockFetchNoContent()
    await deleteTif(TIF_ID)
    expect(fetchInit().method).toBe('DELETE')
  })

  it("downloads a TIF's form and an inspection's DOT forms through their signed URLs", async () => {
    const download = vi.spyOn(exports, 'downloadFile').mockImplementation(() => {})
    mockFetch(200, { data: { url: 'https://s/t', expires_at: 'x', file_name: 'tif.pdf' } })
    expect(await downloadTifForm(TIF_ID)).toBe('tif.pdf')
    expect(fetchUrl().pathname).toBe(`/v1/ped-ramp-tifs/${TIF_ID}/dot-pdf`)
    mockFetch(200, { data: { url: 'https://s/i', expires_at: 'x', file_name: 'dot.zip' } })
    expect(await downloadInspectionDotForms(INSPECTION_ID)).toBe('dot.zip')
    expect(fetchUrl().pathname).toBe(`/v1/ped-ramp-inspections/${INSPECTION_ID}/dot-pdf`)
    expect(download.mock.calls).toEqual([['https://s/t', 'tif.pdf'], ['https://s/i', 'dot.zip']])
  })

  it("reads a corner's inspection report as data", async () => {
    mockFetch(200, { data: { ramps: [] } })
    expect(await getInspectionReport('d1')).toEqual({ ramps: [] })
    expect(fetchUrl().pathname).toBe('/v1/ped-ramp-corners/d1/inspection-report')
  })
})
