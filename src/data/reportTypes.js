// Report types as the backend names them (ReportType enum codes). Add a type to ADDABLE_REPORT_TYPES and
// REPORT_TYPES_WITH_PAGE once its form page exists; codes without a label display as the raw code.

const REPORT_TYPE_LABELS = {
  GEN: 'General',
}

export const ADDABLE_REPORT_TYPES = ['GEN']

const REPORT_TYPES_WITH_PAGE = new Set(['GEN'])

/** Display name for a report type code, e.g. 'GEN' → 'General'. */
export function reportTypeLabel(code) {
  return REPORT_TYPE_LABELS[code] || code
}

/** Whether a report type has a form page the Open button can go to. */
export function hasReportPage(code) {
  return REPORT_TYPES_WITH_PAGE.has(code)
}
