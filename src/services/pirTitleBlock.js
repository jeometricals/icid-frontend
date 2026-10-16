import { apiFetch } from './apiClient'

// A PIR's title block as the Construction Report prints it (R1h.2): page 1's contract number and three dates (on its
// pir_annotations row) and the PIR's north bearing. {pir_id, contract_no, date_notice_issued, date_excavated,
// date_constructed (each 'YYYY-MM-DD' or null), north_bearing ('N' ... 'NW', or null)}.

/**
 * Fetches a page's title block, the whole row (its contract number, dates, streets, widths, status ...), or null when
 * the page has none yet. For anyone on the project.
 */
export async function getPageTitleBlock(pirPageId) {
  const json = await apiFetch(`/v1/pir-pages/${pirPageId}/annotations`)
  return json.data
}

/**
 * Saves some of a PIR's title block: any of {contract_no, date_notice_issued, date_excavated, date_constructed,
 * north_bearing}; a field left out is unchanged, a null clears it. Returns the whole title block as it now is. The
 * backend answers 400 naming a field that doesn't fit (or "PIR has no page 1 to edit"), 403 for a demo user or
 * someone not on the project, and 404 for an unknown PIR.
 */
export async function updatePirTitleBlock(pirId, changes) {
  const json = await apiFetch(`/v1/pirs/${pirId}/title-block`, { method: 'PATCH', body: changes })
  return json.data
}
