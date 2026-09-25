import { describe, it, expect } from 'vitest'
import { REPORT_TYPES, reportTypeLabel, isReportTypeAvailable } from '../reportTypes'

// The backend's ReportType enum (R2), in order
const BACKEND_ENUM = [
  'GEN', 'SWR', 'HC', 'WM_1', 'WM_2', 'WM_3', 'AC', 'CONC', 'BOX', 'PILE', 'JACK', 'CCL', 'RE', 'DSP', 'OFF',
  'SKETCH', 'CONT', 'CONC_MIX', 'CONC_CYL', 'FIELD_MEMO', 'FIELD_ORDER',
]

describe('reportTypes', () => {
  it('lists exactly the 21 backend enum codes, in enum order', () => {
    expect(REPORT_TYPES.map(t => t.code)).toEqual(BACKEND_ENUM)
  })

  it('gives every type a readable label', () => {
    expect(reportTypeLabel('GEN')).toBe('General')
    expect(reportTypeLabel('WM_2')).toBe('Water Main (Sheet 2)')
    expect(reportTypeLabel('CONC_MIX')).toBe('Concrete Truck & Mix Info')
    for (const { code, label } of REPORT_TYPES) expect(label).not.toBe(code)
  })

  it('shows an unknown code as-is', () => {
    expect(reportTypeLabel('NEW_TYPE')).toBe('NEW_TYPE')
  })

  it('has only General available for now', () => {
    expect(BACKEND_ENUM.filter(isReportTypeAvailable)).toEqual(['GEN'])
  })
})
