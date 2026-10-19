import { describe, it, expect } from 'vitest'
import {
  ANSWERS, FIELD_ORDER_NUMBER_REQUIRED, MOS_ITEMS, MPT_ITEMS, dspFormData, dspHasNoAnswers, dspSaveError, emptyDspData,
  needsDetails,
} from '../dspForm'

// The backend's keys (api/schemas/dsp_report.py), in DSP Fr's order
const BACKEND_MOS = [
  'waste_rubbish_debris_removed', 'open_trenches_plated_fenced', 'stored_materials_secured', 'open_paved_areas_swept',
  'trees_protected', 'temporary_pavement_maintained',
]
const BACKEND_MPT = [
  'traffic_maintained_per_plan', 'advance_warning_signs', 'traffic_control_signs', 'tapers_transitions', 'barrels',
  'flashing_lights', 'breakaway_barricades', 'arrow_boards', 'timber_curbs_concrete_barriers',
  'steel_pedestrian_fencing', 'pedestrian_building_access', 'fire_hydrant_access', 'open_sidewalks_clean',
  'closed_sidewalk_signs', 'commercial_area_access', 'flaggers_temp_signs',
]

describe('dspForm items', () => {
  it('lists the 6 Maintenance of Site and 16 traffic items in the backend order', () => {
    expect(MOS_ITEMS.map(i => i.key)).toEqual(BACKEND_MOS)
    expect(MPT_ITEMS.map(i => i.key)).toEqual(BACKEND_MPT)
  })

  it("asks DSP Fr's questions, its runs of spaces collapsed", () => {
    expect(MOS_ITEMS[0].question).toBe('Has waste, rubbish and debris been removed from site ?')
    expect(MPT_ITEMS[0].question).toBe('Is traffic maintained in accordance with approved traffic plan / stipulations ?')
    expect(MPT_ITEMS[15].question).toBe('Are adequate flaggers / temporary signs utilized when required ?')
    for (const { question } of [...MOS_ITEMS, ...MPT_ITEMS]) expect(question).not.toMatch(/ {2}/)
  })

  it('answers yes, no or N/A, as the backend stores them', () => {
    expect(ANSWERS.map(a => a.value)).toEqual(['yes', 'no', 'na'])
  })
})

describe('emptyDspData', () => {
  it('is the whole form with nothing answered and no field order', () => {
    const data = emptyDspData()
    expect(Object.keys(data)).toEqual(['timeOfPatrol', 'mosChecklist', 'mptChecklist', 'fieldOrderIssued',
      'fieldOrderNumber'])
    expect(data.mosChecklist).toHaveLength(6)
    expect(data.mptChecklist).toHaveLength(16)
    expect(data.mosChecklist[0]).toEqual({ item: 'waste_rubbish_debris_removed', answer: null, details: null })
    expect([data.timeOfPatrol, data.fieldOrderIssued, data.fieldOrderNumber]).toEqual([null, false, null])
  })

  it('gives a fresh object each time', () => {
    expect(emptyDspData().mosChecklist).not.toBe(emptyDspData().mosChecklist)
  })
})

describe('dspFormData', () => {
  it('loads a never-saved report as the blank form', () => {
    expect(dspFormData({})).toEqual(emptyDspData())
    expect(dspFormData(null)).toEqual(emptyDspData())
  })

  it('keeps what was saved', () => {
    const saved = emptyDspData()
    saved.timeOfPatrol = '14:30'
    saved.mptChecklist[3] = { item: 'tapers_transitions', answer: 'no', details: 'Taper short' }
    saved.fieldOrderIssued = true
    saved.fieldOrderNumber = 'FO-12'
    expect(dspFormData(saved)).toEqual(saved)
  })

  it('finds rows by item and fills in what is missing or unknown', () => {
    const data = dspFormData({
      mosChecklist: [{ item: 'trees_protected', answer: 'yes' }, { item: 'not_an_item', answer: 'no' }],
      mptChecklist: [{ item: 'barrels', answer: 'maybe', details: 4 }],
      fieldOrderIssued: 'yes',
    })
    expect(data.mosChecklist.map(r => r.answer)).toEqual([null, null, null, null, 'yes', null])
    expect(data.mptChecklist[4]).toEqual({ item: 'barrels', answer: null, details: null })
    expect(data.fieldOrderIssued).toBe(false)
  })
})

describe('dspSaveError and needsDetails', () => {
  it('blocks a save with a field order issued but no number', () => {
    expect(dspSaveError({ ...emptyDspData(), fieldOrderIssued: true })).toBe(FIELD_ORDER_NUMBER_REQUIRED)
    expect(dspSaveError({ ...emptyDspData(), fieldOrderIssued: true, fieldOrderNumber: '   ' }))
      .toBe(FIELD_ORDER_NUMBER_REQUIRED)
    expect(dspSaveError({ ...emptyDspData(), fieldOrderIssued: true, fieldOrderNumber: 'FO-12' })).toBeNull()
    expect(dspSaveError(emptyDspData())).toBeNull()
  })

  it('warns on a No with no details, and only then', () => {
    expect(needsDetails({ answer: 'no', details: null })).toBe(true)
    expect(needsDetails({ answer: 'no', details: '  ' })).toBe(true)
    expect(needsDetails({ answer: 'no', details: 'Trench open' })).toBe(false)
    expect(needsDetails({ answer: 'yes', details: null })).toBe(false)
    expect(needsDetails({ answer: null, details: null })).toBe(false)
  })
})

describe('dspHasNoAnswers', () => {
  it('is true for a never-saved report and a blank form', () => {
    expect(dspHasNoAnswers({})).toBe(true)
    expect(dspHasNoAnswers(null)).toBe(true)
    expect(dspHasNoAnswers(emptyDspData())).toBe(true)
  })

  it('is false once any row of either checklist is answered, N/A included', () => {
    const mos = emptyDspData()
    mos.mosChecklist[2].answer = 'na'
    expect(dspHasNoAnswers(mos)).toBe(false)
    const mpt = emptyDspData()
    mpt.mptChecklist[15].answer = 'no'
    expect(dspHasNoAnswers(mpt)).toBe(false)
  })
})
