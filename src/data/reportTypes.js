// Report types as the backend names them (ReportType enum codes), in enum order, with their display names.

export const REPORT_TYPES = [
  { code: 'GEN', label: 'General' },
  { code: 'SWR', label: 'Sewer' },
  { code: 'HC', label: 'House Connection' },
  { code: 'WM_1', label: 'Water Main (Sheet 1)' },
  { code: 'WM_2', label: 'Water Main (Sheet 2)' },
  { code: 'WM_3', label: 'Water Main (Sheet 3)' },
  { code: 'AC', label: 'Asphalt Concrete' },
  { code: 'CONC', label: 'Concrete (Structures)' },
  { code: 'BOX', label: 'Box' },
  { code: 'PILE', label: 'Pile Driving' },
  { code: 'JACK', label: 'Jacking' },
  { code: 'CCL', label: 'Concrete Cylinder' },
  { code: 'RE', label: 'Retaining Wall' },
  { code: 'DSP', label: 'Daily Site Patrol' },
  { code: 'OFF', label: 'Officer Report' },
  { code: 'SKETCH', label: 'Sketch Sheet' },
  { code: 'CONT', label: 'Report Continuation' },
  { code: 'CONC_MIX', label: 'Concrete Truck & Mix Info' },
  { code: 'CONC_CYL', label: 'Concrete Cylinder Data' },
  { code: 'FIELD_MEMO', label: 'Field Memo' },
  { code: 'FIELD_ORDER', label: 'Field Order' },
]

// Types whose form page exists: they can be added to an IDR and opened. Add a code here once its page is built.
const AVAILABLE_REPORT_TYPES = new Set(['GEN'])

const LABELS = Object.fromEntries(REPORT_TYPES.map(({ code, label }) => [code, label]))

/** Display name for a report type code, e.g. 'GEN' → 'General'; unknown codes show as-is. */
export function reportTypeLabel(code) {
  return LABELS[code] || code
}

/** Whether a report type has a form page, so it can be added to an IDR and opened. */
export function isReportTypeAvailable(code) {
  return AVAILABLE_REPORT_TYPES.has(code)
}
