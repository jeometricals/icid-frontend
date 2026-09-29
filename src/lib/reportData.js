// Form-state helpers shared by the report pages (General, SWCB, …): the blank state of the sections every report
// has, and turning a report's saved report_data into form state.

// Keys older General reports stored in report_data that now live on the IDR (date, sheet, times, temps, weather).
// Dropped when a report loads, so they're never shown or saved again.
export const IDR_LEVEL_KEYS = [
  'date', 'sheetNo', 'dayOfWeek',
  'workActivityStart', 'workActivityEnd', 'inspectorTimeStart', 'inspectorTimeEnd',
  'dailyTempLow', 'dailyTempHigh', 'weatherAM', 'weatherPM',
]

// Older reports stored safety checks as booleans (true = Y, false = N); strings and null pass through
function normalizeSafetyCheck(value) {
  if (value === true) return 'Y'
  if (value === false) return 'N'
  return value
}

// Older reports used singular workforce keys; renamed to plurals on load (the new key wins if both exist)
const LEGACY_WORKFORCE_KEYS = { foreman: 'foremen', operator: 'operators', flagger: 'flaggers' }

function normalizeWorkforce(workforce) {
  const result = { ...workforce }
  for (const [oldKey, newKey] of Object.entries(LEGACY_WORKFORCE_KEYS)) {
    if (!(oldKey in result)) continue
    if (!(newKey in result)) result[newKey] = result[oldKey]
    delete result[oldKey]
  }
  return result
}

/**
 * Blank state for the sections every report shares: pay items, workforce, equipment, safety checklist and comments.
 * Returns a fresh object each call; a page spreads it into its own blank form next to its report-specific fields.
 */
export function sharedSectionDefaults() {
  return {
    payItems: [],
    workforce: {
      superintendent: '',
      foremen: '',
      operators: '',
      laborers: '',
      flaggers: ''
    },
    additionalWorkforce: [],
    equipment: {
      frontEndLoader: { model: '', number: '' },
      backhoe: { model: '', number: '' },
      truckDump: { model: '', number: '' },
      compressor: { model: '', number: '' },
      excavator: { model: '', number: '' }
    },
    additionalEquipment: [],
    safetyChecks: {
      plasticBarrels: null,
      pedestrianBarricades: null,
      timberCurbs: null,
      timberBreakawayBarricades: null,
      generalSafety: null,
      localEmergencyAccess: null,
      fencing: null,
      plates: null,
      arrowBoard: null,
      siteCleaned: null
    },
    safetyRemarks: {
      plasticBarrels: '',
      pedestrianBarricades: '',
      timberCurbs: '',
      timberBreakawayBarricades: '',
      generalSafety: '',
      localEmergencyAccess: '',
      fencing: '',
      plates: '',
      arrowBoard: '',
      siteCleaned: ''
    },
    comments: ''
  }
}

/**
 * A report's saved report_data as form state, given that page's blank form (defaults). Fills missing keys from the
 * defaults (including missing workforce roles, equipment types and safety remarks), drops IDR-level keys, renames
 * legacy workforce keys, converts boolean safety checks to 'Y' / 'N' and drops the retired pay item quantityChk.
 */
export function formDataFromReportData(reportData, defaults) {
  const data = { ...defaults, ...reportData }
  for (const key of IDR_LEVEL_KEYS) delete data[key]
  data.workforce = { ...defaults.workforce, ...normalizeWorkforce(data.workforce) }
  data.equipment = { ...defaults.equipment, ...data.equipment }
  // Older reports stored one never-displayed safetyRemarks string; it's dropped for the per-item object
  const savedRemarks = typeof data.safetyRemarks === 'object' && data.safetyRemarks !== null ? data.safetyRemarks : {}
  data.safetyRemarks = { ...defaults.safetyRemarks, ...savedRemarks }
  data.payItems = data.payItems.map(({ quantityChk, ...item }) => item)
  data.safetyChecks = Object.fromEntries(
    Object.entries(data.safetyChecks).map(([key, value]) => [key, normalizeSafetyCheck(value)])
  )
  return data
}
