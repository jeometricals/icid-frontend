import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import IdrContextLine from '../IdrContextLine'

const IDR = {
  report_date: '2026-09-27',
  weather_am: 'Clear',
  weather_pm: 'Cloudy',
  temp_low: 42.0,
  temp_high: 61.5,
  work_start_time: '07:30:00',
  work_end_time: '16:00:00',
}

const text = idr => render(<IdrContextLine idr={idr} />).container.textContent

describe('IdrContextLine', () => {
  it('shows date, weather, temps and work hours from the IDR', () => {
    expect(text(IDR)).toContain('Date: Sep 27, 2026 · Weather: Clear / Cloudy · Temp: 42 / 61.5 °F · Work: 07:30 - 16:00')
  })

  it('says the values are set on the IDR page', () => {
    expect(text(IDR)).toContain('Set on the IDR page')
  })

  it('shows — for a missing half of a pair', () => {
    expect(text({ ...IDR, weather_pm: null, temp_low: null, work_end_time: null }))
      .toContain('Weather: Clear / — · Temp: — / 61.5 °F · Work: 07:30 - —')
  })

  it('shows a single — when both halves are missing', () => {
    expect(text({ report_date: '2026-09-27' }))
      .toContain('Date: Sep 27, 2026 · Weather: — · Temp: — · Work: —')
  })

  it('keeps the date in local time (no off-by-one day)', () => {
    expect(text({ ...IDR, report_date: '2025-09-16' })).toContain('Date: Sep 16, 2025')
  })
})
