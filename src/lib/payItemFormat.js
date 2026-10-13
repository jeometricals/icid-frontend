// How the admin's pay-item pages print a pay item's amounts.

// A quantity: thousands separated, three decimals at most
export function formatPayItemQuantity(quantity) {
  return quantity.toLocaleString('en-US', { maximumFractionDigits: 3 })
}

// A unit price: dollars, thousands separated, two decimals
export function formatUnitPrice(price) {
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
