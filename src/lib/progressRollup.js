// The units the Progress page always shows a total for, in this order; any other unit follows them
export const STANDING_UNITS = ['TN', 'LF', 'SF', 'EA']

// What the backend sums rows without a unit under
export const UNKNOWN_UNIT = '(unknown)'

// Sums of amounts are sums of floats; this trims what that leaves behind (0.1 + 0.2)
const tidy = amount => Math.round(amount * 1e6) / 1e6

/**
 * Rolls quantity rows up to one line per pay item.
 * Takes listQuantities rows. Rows are grouped by item number, budget code and unit; rows with no item number (a
 * reviewer can add an item by its description alone) are grouped by their description as well, so unrelated ones
 * stay apart.
 * Returns [{pay_item_ref, description, budget_code, unit, total_qty}], total_qty the sum of the group's amounts and
 * description the first one the group has, sorted by item number (as numbers where they are numbers), items
 * without one last.
 */
export function rollupByItem(rows) {
  const groups = new Map()
  for (const row of rows) {
    const ref = row.pay_item_ref || null
    const key = JSON.stringify([ref, row.budget_code || null, row.unit || null, ref ? null : row.description || null])
    const group = groups.get(key)
    if (group) {
      group.total_qty += row.amount
      group.description = group.description || row.description || null
    } else {
      groups.set(key, {
        pay_item_ref: ref,
        description: row.description || null,
        budget_code: row.budget_code || null,
        unit: row.unit || null,
        total_qty: row.amount,
      })
    }
  }
  return [...groups.values()].map(group => ({ ...group, total_qty: tidy(group.total_qty) })).sort(byItem)
}

const compareText = (a, b) => (a || '').localeCompare(b || '', 'en', { numeric: true })

function byItem(a, b) {
  if (Boolean(a.pay_item_ref) !== Boolean(b.pay_item_ref)) return a.pay_item_ref ? -1 : 1
  return compareText(a.pay_item_ref, b.pay_item_ref) || compareText(a.budget_code, b.budget_code)
    || compareText(a.unit, b.unit) || compareText(a.description, b.description)
}

/**
 * Lays a response's totals_by_unit out as the page's tiles.
 * Takes the totals ({unit: sum}; undefined or {} when there are none to show).
 * Returns [{unit, total}]: the standing units first, total null for one with no rows, then every other unit in
 * alphabetical order, the unknown unit last.
 */
export function unitTiles(totalsByUnit = {}) {
  const others = Object.keys(totalsByUnit)
    .filter(unit => !STANDING_UNITS.includes(unit))
    .sort((a, b) => (a === UNKNOWN_UNIT) - (b === UNKNOWN_UNIT) || a.localeCompare(b))
  return [...STANDING_UNITS, ...others].map(unit => ({
    unit,
    total: unit in totalsByUnit ? tidy(totalsByUnit[unit]) : null,
  }))
}

// A quantity as the page prints it: thousands separated, three decimals at most
export function formatQuantity(amount) {
  return amount.toLocaleString('en-US', { maximumFractionDigits: 3 })
}
