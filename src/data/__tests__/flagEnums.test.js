import { describe, it, expect } from 'vitest'
import { FLAG_NON_ASSESSABLE_REASONS, areaReasonLabel, nonAssessableReasonLabel } from '../flagEnums'

describe('flagEnums: outside_property_line (Slice Y1.5)', () => {
  it('is a reason a flag can have, labelled for the flag editor', () => {
    expect(FLAG_NON_ASSESSABLE_REASONS.map(reason => reason.value)).toContain('outside_property_line')
    expect(nonAssessableReasonLabel('outside_property_line')).toBe('Outside property line')
  })

  it('is a reason an area can have too, as the backend allows', () => {
    expect(areaReasonLabel('outside_property_line')).toBe('Outside property line')
  })
})
