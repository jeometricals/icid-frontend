import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { generateExport, downloadFile } from '../exports'
import { mockFetch, fetchUrl } from '../../test/mockFetch'

const IDR_ID = '5a0e8c1d-0000-4000-8000-00000000000a'
const DOWNLOAD_URL = 'https://example.supabase.co/storage/v1/object/sign/idr-exports/x.xlsx?token=t'
const FILENAME = `IDR_${IDR_ID}_2026-09-30.xlsx`

let clicked

beforeEach(() => {
  vi.restoreAllMocks()
  clicked = []
  // jsdom doesn't navigate; record each clicked link with what it held at the time
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
    clicked.push({ href: this.href, download: this.download, attached: document.body.contains(this) })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('generateExport', () => {
  it('asks the backend for the export and downloads the file it points to', async () => {
    mockFetch(200, { download_url: DOWNLOAD_URL, filename: FILENAME })
    await expect(generateExport(IDR_ID)).resolves.toBe(FILENAME)
    expect(fetchUrl().pathname).toBe(`/v1/idrs/${IDR_ID}/export`)
    expect(clicked).toEqual([{ href: DOWNLOAD_URL, download: FILENAME, attached: true }])
  })

  it('throws with the status when the IDR is gone, and downloads nothing', async () => {
    mockFetch(404, { detail: 'IDR not found' })
    await expect(generateExport(IDR_ID)).rejects.toMatchObject({ status: 404, message: 'IDR not found' })
    expect(clicked).toEqual([])
  })
})

describe('downloadFile', () => {
  it('clicks a temporary link and removes it again', () => {
    downloadFile(DOWNLOAD_URL, FILENAME)
    expect(clicked).toEqual([{ href: DOWNLOAD_URL, download: FILENAME, attached: true }])
    expect(document.querySelectorAll('a')).toHaveLength(0)
  })
})
