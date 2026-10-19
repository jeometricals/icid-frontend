// The Daily Site Patrol (DSP) form, as DDC's DSP Fr sheet prints it and the backend checks it (DspReport,
// api/schemas/dsp_report.py): the Maintenance of Site and Maintenance and Protection of Traffic checklists, each item
// by the key report_data stores it under, in the form's order, with the question the sheet asks.

export const MOS_ITEMS = [
  { key: 'waste_rubbish_debris_removed', question: 'Has waste, rubbish and debris been removed from site ?' },
  { key: 'open_trenches_plated_fenced', question: 'Are all open trenches plated or fully enclosed with adequate fencing ?' },
  { key: 'stored_materials_secured', question: 'Are all stored materials/equipment properly secured and protected ?' },
  { key: 'open_paved_areas_swept', question: 'Are all open paved areas swept clean ?' },
  { key: 'trees_protected', question: 'Are all trees properly protected ?' },
  { key: 'temporary_pavement_maintained', question: 'Is temporary pavement being maintained ?' },
]

export const MPT_ITEMS = [
  { key: 'traffic_maintained_per_plan', question: 'Is traffic maintained in accordance with approved traffic plan / stipulations ?' },
  { key: 'advance_warning_signs', question: 'Are all advance warning signs in place ?' },
  { key: 'traffic_control_signs', question: 'Are all required traffic control signs in place ?' },
  { key: 'tapers_transitions', question: 'Are all tapers and transitions in place ?' },
  { key: 'barrels', question: 'Are all required barrels in place ?' },
  { key: 'flashing_lights', question: 'Are sufficient flashing lights in place and working ?' },
  { key: 'breakaway_barricades', question: 'Are breakaway barricades installed where required ?' },
  { key: 'arrow_boards', question: 'Are required arrow boards in place ?' },
  { key: 'timber_curbs_concrete_barriers', question: 'Are timber curbs / concrete barriers installed where required ?' },
  { key: 'steel_pedestrian_fencing', question: 'Is steel pedestrian fencing in place as required ?' },
  { key: 'pedestrian_building_access', question: 'Is pedestrian access to / from building being maintained ?' },
  { key: 'fire_hydrant_access', question: 'Is access to all fire hydrants provided ?' },
  { key: 'open_sidewalks_clean', question: 'Are all open sidewalks clean and unobstructed ?' },
  { key: 'closed_sidewalk_signs', question: 'Are appropriate signs in place for closed sidewalks ?' },
  { key: 'commercial_area_access', question: 'Is required access to commercial areas properly maintained ?' },
  { key: 'flaggers_temp_signs', question: 'Are adequate flaggers / temporary signs utilized when required ?' },
]

// The answers a row takes, as stored, with the column heads DSP Fr prints; null is unanswered
export const ANSWERS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'na', label: 'N/A' },
]

// The backend's limits (400 past them)
export const DETAILS_MAX_LENGTH = 2000
export const FIELD_ORDER_NUMBER_MAX_LENGTH = 50

export const FIELD_ORDER_NUMBER_REQUIRED = 'Enter the field order number, or set Field Order Issued to No.'

const blankRows = (items) => items.map(({ key }) => ({ item: key, answer: null, details: null }))

/** A blank DSP report_data: nothing answered, no field order (the shape the backend accepts on the first save). */
export function emptyDspData() {
  return {
    timeOfPatrol: null,
    mosChecklist: blankRows(MOS_ITEMS),
    mptChecklist: blankRows(MPT_ITEMS),
    fieldOrderIssued: false,
    fieldOrderNumber: null,
  }
}

const ANSWER_VALUES = new Set(ANSWERS.map(a => a.value))

// One checklist as the form holds it: a row per item, in the form's order, whatever the saved list held (a row out
// of place is found by its item; an item missing, or with an answer the form doesn't know, starts blank)
function checklistRows(saved, items) {
  const byItem = new Map()
  for (const row of Array.isArray(saved) ? saved : []) {
    if (row && typeof row === 'object' && !byItem.has(row.item)) byItem.set(row.item, row)
  }
  return items.map(({ key }) => {
    const row = byItem.get(key) ?? {}
    return {
      item: key,
      answer: ANSWER_VALUES.has(row.answer) ? row.answer : null,
      details: typeof row.details === 'string' ? row.details : null,
    }
  })
}

/** A DSP report's saved report_data as form state: always the full form, so a never-saved ({}) report loads blank. */
export function dspFormData(reportData) {
  const data = reportData && typeof reportData === 'object' ? reportData : {}
  return {
    timeOfPatrol: typeof data.timeOfPatrol === 'string' && data.timeOfPatrol ? data.timeOfPatrol : null,
    mosChecklist: checklistRows(data.mosChecklist, MOS_ITEMS),
    mptChecklist: checklistRows(data.mptChecklist, MPT_ITEMS),
    fieldOrderIssued: typeof data.fieldOrderIssued === 'boolean' ? data.fieldOrderIssued : false,
    fieldOrderNumber: typeof data.fieldOrderNumber === 'string' ? data.fieldOrderNumber : null,
  }
}

/** Why a DSP can't be saved as it stands (the backend refuses it with a 400 too), or null when it can. */
export function dspSaveError(data) {
  if (data.fieldOrderIssued && !(data.fieldOrderNumber ?? '').trim()) return FIELD_ORDER_NUMBER_REQUIRED
  return null
}

/** Whether a row deserves the "No without details" warning: answered No with nothing written. Never blocks a save. */
export function needsDetails(row) {
  return row.answer === 'no' && !(row.details ?? '').trim()
}

export const DSP_UNANSWERED_CONFIRM = 'DSP report has no answers; submit anyway?'

/** Whether a DSP report's saved report_data has no checklist answer at all (a never-saved {} report included). */
export function dspHasNoAnswers(reportData) {
  const data = dspFormData(reportData)
  return [...data.mosChecklist, ...data.mptChecklist].every(row => row.answer === null)
}
