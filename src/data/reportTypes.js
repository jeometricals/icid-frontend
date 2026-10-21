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
  { code: 'AC', label: 'Asphaltic Concrete', route: 'ac' },
  { code: 'CONC', label: 'Concrete (Structures)' },
  { code: 'BOX', label: 'Box Sewer' },
  { code: 'PILE', label: 'Pile Driving' },
  { code: 'JACK', label: 'Jacking' },
  { code: 'CCL', label: 'Community Construction Liaison' },
  { code: 'RE', label: "Resident Engineer's Daily Diary" },
  { code: 'DSP', label: 'Daily Site Patrol', route: 'dsp' },
  { code: 'OFF', label: 'Office Report' },
  { code: 'SKETCH', label: 'Sketch Sheet' },
  { code: 'CONT', label: 'Report Continuation' },
  { code: 'CONC_MIX', label: 'Concrete Truck & Mix Info', route: 'conc-mix' },
  { code: 'CONC_CYL', label: 'Concrete Cylinder Data', route: 'conc-cyl' },
  { code: 'FIELD_MEMO', label: 'Field Memo' },
  { code: 'FIELD_ORDER', label: 'Field Order' },
]

// Types whose form page exists: they can be added to an IDR and opened. Add a code here once its page is built.
const AVAILABLE_REPORT_TYPES = new Set(['GEN', 'SWCB', 'AC', 'DSP', 'CONC_MIX', 'CONC_CYL'])

// Types that are addendums by nature (the backend's ADDENDUM_TYPES). They're added from their parent report's page,
// not from the IDR's top-level Add report control. DSP is not one: it is a top-level report, one per IDR.
const ADDENDUM_TYPES = new Set(['SKETCH', 'CONT', 'CONC_MIX', 'WM_2', 'WM_3', 'CONC_CYL'])

// Parent report types that take no addendum: a Daily Site Patrol has no Conc Mix or Conc Cyl (Slice W1). Its sketches
// and photos are attachments.
const NO_ADDENDUM_PARENTS = new Set(['DSP'])

/** Tooltip of the Add report control's Daily Site Patrol once the IDR has its one DSP. */
export const DSP_TAKEN_TOOLTIP = 'DSP already added to this IDR.'

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

/** The IDR's Daily Site Patrol among its reports (an IDR holds at most one), or undefined. */
export function findDsp(reports) {
  return reports.find(r => r.report_type === 'DSP')
}

/** A report's form page, /project/:projectId/idr/:idrId/<route>/:reportId. */
export function reportPagePath(projectId, idrId, report) {
  return `/project/${projectId}/idr/${idrId}/${reportTypeRoute(report.report_type)}/${report.report_id}`
}

/** The addendum types with a form page that a main report of the given type can add, in catalog order. */
export function addendumTypesFor(parentType) {
  if (NO_ADDENDUM_PARENTS.has(parentType)) return []
  return REPORT_TYPES.filter(({ code }) => isAddendumType(code) && isReportTypeAvailable(code))
}

/** Whether a report type has a form page, so it can be added to an IDR and opened. */
export function isReportTypeAvailable(code) {
  return AVAILABLE_REPORT_TYPES.has(code)
}
