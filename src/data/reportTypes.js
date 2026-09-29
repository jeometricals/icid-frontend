// Report types as the backend names them (ReportType enum codes), in enum order, with their display names.
// Types with a form page also carry its URL segment (route), as in /project/:projectId/idr/:idrId/<route>/:reportId.

export const REPORT_TYPES = [
  { code: 'GEN', label: 'General', route: 'general' },
  { code: 'SWR', label: 'Sewer' },
  { code: 'HC', label: 'House Connection' },
  { code: 'SWCB', label: 'Sidewalk, Curb, Concrete Base', route: 'swcb' },
  { code: 'WM_1', label: 'Water Main (Sheet 1)' },
  { code: 'WM_2', label: 'Water Main (Sheet 2)' },
  { code: 'WM_3', label: 'Water Main (Sheet 3)' },
  { code: 'AC', label: 'Asphalt Concrete' },
  { code: 'CONC', label: 'Concrete (Structures)' },
  { code: 'BOX', label: 'Box Sewer' },
  { code: 'PILE', label: 'Pile Driving' },
  { code: 'JACK', label: 'Jacking' },
  { code: 'CCL', label: 'Community Construction Liaison' },
  { code: 'RE', label: "Resident Engineer's Daily Diary" },
  { code: 'DSP', label: 'Daily Site Patrol' },
  { code: 'OFF', label: 'Office Report' },
  { code: 'SKETCH', label: 'Sketch Sheet' },
  { code: 'CONT', label: 'Report Continuation' },
  { code: 'CONC_MIX', label: 'Concrete Truck & Mix Info', route: 'conc-mix' },
  { code: 'CONC_CYL', label: 'Concrete Cylinder Data' },
  { code: 'FIELD_MEMO', label: 'Field Memo' },
  { code: 'FIELD_ORDER', label: 'Field Order' },
]

// Types whose form page exists: they can be added to an IDR and opened. Add a code here once its page is built.
const AVAILABLE_REPORT_TYPES = new Set(['GEN', 'SWCB', 'CONC_MIX'])

// Types that are addendums by nature, as the backend's ADDENDUM_TYPES lists them (DSP can be either, so it's absent).
// They're added from their parent report's page, not from the IDR's top-level Add report control.
const ADDENDUM_TYPES = new Set(['SKETCH', 'CONT', 'CONC_MIX', 'WM_2', 'WM_3', 'CONC_CYL'])

const LABELS = Object.fromEntries(REPORT_TYPES.map(({ code, label }) => [code, label]))

/** Display name for a report type code, e.g. 'GEN' → 'General'; unknown codes show as-is. */
export function reportTypeLabel(code) {
  return LABELS[code] || code
}

/** URL segment of a report type's form page, e.g. 'GEN' → 'general'; undefined for types without a page. */
export function reportTypeRoute(code) {
  return REPORT_TYPES.find(t => t.code === code)?.route
}

/** Whether a report type is an addendum by nature, added from its parent report rather than at the IDR level. */
export function isAddendumType(code) {
  return ADDENDUM_TYPES.has(code)
}

/** Whether a report type has a form page, so it can be added to an IDR and opened. */
export function isReportTypeAvailable(code) {
  return AVAILABLE_REPORT_TYPES.has(code)
}
