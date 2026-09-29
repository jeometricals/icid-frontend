import { describe, it, expect } from 'vitest'
import { REPORT_TYPES, reportTypeLabel, reportTypeRoute, isReportTypeAvailable } from '../reportTypes'

// The backend's ReportType enum, in order
const BACKEND_ENUM = [
  'GEN', 'SWR', 'HC', 'SWCB', 'WM_1', 'WM_2', 'WM_3', 'AC', 'CONC', 'BOX', 'PILE', 'JACK', 'CCL', 'RE', 'DSP', 'OFF',
  'SKETCH', 'CONT', 'CONC_MIX', 'CONC_CYL', 'FIELD_MEMO', 'FIELD_ORDER',
]

describe('reportTypes', () => {
  it('lists exactly the 22 backend enum codes, in enum order', () => {
    expect(REPORT_TYPES.map(t => t.code)).toEqual(BACKEND_ENUM)
  })

  it('gives every type a readable label', () => {
    expect(reportTypeLabel('GEN')).toBe('General')
    expect(reportTypeLabel('WM_2')).toBe('Water Main (Sheet 2)')
    expect(reportTypeLabel('CONC_MIX')).toBe('Concrete Truck & Mix Info')
    expect(reportTypeLabel('SWCB')).toBe('Sidewalk, Curb, Concrete Base')
    for (const { code, label } of REPORT_TYPES) expect(label).not.toBe(code)
  })

  it('shows an unknown code as-is', () => {
    expect(reportTypeLabel('NEW_TYPE')).toBe('NEW_TYPE')
  })

  it('gives each type with a page its URL segment, and none to types without one', () => {
    expect(reportTypeRoute('GEN')).toBe('general')
    expect(reportTypeRoute('SWCB')).toBe('swcb')
    expect(reportTypeRoute('SWR')).toBeUndefined()
    expect(reportTypeRoute('NEW_TYPE')).toBeUndefined()
  })

  it('has a route for exactly the available types', () => {
    expect(REPORT_TYPES.filter(t => t.route).map(t => t.code)).toEqual(BACKEND_ENUM.filter(isReportTypeAvailable))
  })

  it('has only General and SWCB available for now', () => {
    expect(BACKEND_ENUM.filter(isReportTypeAvailable)).toEqual(['GEN', 'SWCB'])
  })
})
