import { describe, it, expect } from 'vitest'
import { REPORT_TYPES, reportTypeLabel, reportTypeRoute, isAddendumType, isReportTypeAvailable } from '../reportTypes'

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
    expect(reportTypeLabel('AC')).toBe('Asphaltic Concrete')
    for (const { code, label } of REPORT_TYPES) expect(label).not.toBe(code)
  })

  it('shows an unknown code as-is', () => {
    expect(reportTypeLabel('NEW_TYPE')).toBe('NEW_TYPE')
  })

  it('gives each type with a page its URL segment, and none to types without one', () => {
    expect(reportTypeRoute('GEN')).toBe('general')
    expect(reportTypeRoute('SWCB')).toBe('swcb')
    expect(reportTypeRoute('AC')).toBe('ac')
    expect(reportTypeRoute('CONC_MIX')).toBe('conc-mix')
    expect(reportTypeRoute('CONC_CYL')).toBe('conc-cyl')
    expect(reportTypeRoute('SWR')).toBeUndefined()
    expect(reportTypeRoute('NEW_TYPE')).toBeUndefined()
  })

  it('has a route for exactly the available types', () => {
    expect(REPORT_TYPES.filter(t => t.route).map(t => t.code)).toEqual(BACKEND_ENUM.filter(isReportTypeAvailable))
  })

  it('has only General, SWCB, Asphaltic Concrete, Concrete Truck & Mix Info and Concrete Cylinder Data available for now', () => {
    expect(BACKEND_ENUM.filter(isReportTypeAvailable)).toEqual(['GEN', 'SWCB', 'AC', 'CONC_MIX', 'CONC_CYL'])
  })

  it("marks the backend's addendum types (not DSP, which can be either)", () => {
    expect(BACKEND_ENUM.filter(isAddendumType)).toEqual(['WM_2', 'WM_3', 'SKETCH', 'CONT', 'CONC_MIX', 'CONC_CYL'])
    expect(isAddendumType('DSP')).toBe(false)
    expect(isAddendumType('GEN')).toBe(false)
  })
})
