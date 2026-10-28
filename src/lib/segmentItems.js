// The pay items a curb run takes (Slice Y4a): the project's items in linear feet, as a segment bills (SEGMENT_UNITS).

/** Whether a contract item is in linear feet, whatever its spelling (L.F., LF, lf). */
export const isLinearFoot = (item) => (item.pay_unit ?? '').replace(/[^A-Za-z]/g, '').toUpperCase() === 'LF'

/** A contract item as a picker lists it: its number, budget code and description. */
export const contractItemLabel = (item) => [item.item_no, item.budget_code, item.description].filter(Boolean).join(' · ')

/**
 * The pay item a new curb starts with: the LF item the PIR's curbs use most, if any of them has one; else none.
 * Takes the project's LF items and the PIR's segments.
 */
export function mostUsedLfItem(lfItems, segments) {
  const counts = {}
  for (const segment of segments) {
    if (segment.pay_item_id && lfItems.some(item => item.contract_item_id === segment.pay_item_id)) {
      counts[segment.pay_item_id] = (counts[segment.pay_item_id] ?? 0) + 1
    }
  }
  const [best] = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return best ? best[0] : null
}
