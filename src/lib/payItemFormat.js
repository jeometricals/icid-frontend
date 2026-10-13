// How the pay-item pages (the admin's catalog and the Progress page) print a pay item's amounts.

// A quantity: thousands separated, three decimals at most
export function formatPayItemQuantity(quantity) {
  return quantity.toLocaleString('en-US', { maximumFractionDigits: 3 })
}

// An amount of money: dollars, thousands separated, to the dollar ($1,205,214) or with cents ($125,430.00)
export function formatDollars(value, { cents = false } = {}) {
  const digits = cents ? 2 : 0
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

// A unit price: dollars, thousands separated, two decimals
export function formatUnitPrice(price) {
  return formatDollars(price, { cents: true })
}

// A percentage: one decimal ("3.8%"), and a dash for one that isn't known
export function formatPercent(value) {
  if (value === null || value === undefined) return '—'
  return `${value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}
