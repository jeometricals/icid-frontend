import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaxMapFrontage from '../TaxMapFrontage'
import * as api from '../../services/api'

vi.mock('../../services/api', () => ({ refreshTaxMap: vi.fn() }))

const SITE = { id: 'd0000000-0000-4000-8000-000000000002', tax_map_frontage_ft: 16.67, tax_map_source: 'mappluto_26v2',
  tax_map_fetched_at: '2026-11-05T14:00:00Z' }

beforeEach(() => { vi.clearAllMocks() })

describe('TaxMapFrontage', () => {
  it('shows a MapPLUTO frontage with its release and the day it was fetched', () => {
    render(<TaxMapFrontage property={SITE} admin={false} onRefreshed={vi.fn()} />)
    expect(screen.getByText('16.67 ft · MapPLUTO 26v2 · fetched 2026-11-05')).toBeInTheDocument()
  })

  it('says set for a manual one', () => {
    render(<TaxMapFrontage property={{ ...SITE, tax_map_frontage_ft: 100, tax_map_source: 'manual' }} admin={false}
      onRefreshed={vi.fn()} />)
    expect(screen.getByText('100.00 ft · Manual · set 2026-11-05')).toBeInTheDocument()
  })

  it('reads unavailable while there is none', () => {
    render(<TaxMapFrontage property={{ ...SITE, tax_map_frontage_ft: null, tax_map_source: null, tax_map_fetched_at: null }}
      admin onRefreshed={vi.fn()} />)
    expect(screen.getByText('— · unavailable')).toBeInTheDocument()
  })

  it('gives only an admin Refresh', () => {
    render(<TaxMapFrontage property={SITE} admin={false} onRefreshed={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Refresh/ })).not.toBeInTheDocument()
  })

  it('refreshes and hands the result on', async () => {
    const refreshed = { frontage_ft: 17, source: 'mappluto_26v3', fetched_at: '2026-11-06T09:00:00Z', pages_updated: 2 }
    let finish
    api.refreshTaxMap.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const onRefreshed = vi.fn()
    render(<TaxMapFrontage property={SITE} admin onRefreshed={onRefreshed} />)
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(screen.getByRole('button', { name: 'Refreshing...' })).toBeDisabled()
    finish(refreshed)
    await waitFor(() => expect(onRefreshed).toHaveBeenCalledWith(refreshed))
    expect(api.refreshTaxMap).toHaveBeenCalledWith(SITE.id)
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled()
  })

  it('shows a refusal under the button in the backend words', async () => {
    api.refreshTaxMap.mockRejectedValue(new Error("MapPLUTO can't be reached right now; nothing was changed. Try again later."))
    const onRefreshed = vi.fn()
    render(<TaxMapFrontage property={SITE} admin onRefreshed={onRefreshed} />)
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("MapPLUTO can't be reached right now")
    expect(onRefreshed).not.toHaveBeenCalled()
  })
})
