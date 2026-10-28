// Match lines in the workspace (Slice Y4b): a line pairs with the one carrying its label on another page (a label is on
// at most two pages of a PIR), as the Construction Report pairs them (R1h.1a's match_line_caption), with pages for
// sheets.

/** The line on another page carrying a line's label, or null. Takes the line and the PIR's lines. */
export function partnerOf(line, lines) {
  return lines.find(other => other.label === line.label && other.pir_page_id !== line.pir_page_id) ?? null
}

/**
 * A line's caption: MATCH LINE "A" — SEE PAGE 2, or MATCH LINE "A" when no other page carries its label.
 * Takes the line and its partner (partnerOf).
 */
export function matchLineCaption(line, partner) {
  return partner ? `MATCH LINE "${line.label}" — SEE PAGE ${partner.page_number}` : `MATCH LINE "${line.label}"`
}
