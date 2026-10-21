/**
 * `?idrId=&reportId=`: the IDR report a site page or its PIR workspace was opened from (Slice W3), beside `?returnTo=`
 * (lib/returnTo.js). With both, the page shows the site's pay items for that IDR (SitePayItemsPanel); without them it
 * is the site on its own. Also the site's pay-item rows its flags and curb segments come to for that IDR.
 */

const IDR = 'idrId'
const REPORT = 'reportId'

/**
 * Reads the IDR context from a query string ('?idrId=...&reportId=...', with or without the '?') or a URLSearchParams.
 * Returns {idrId, reportId}, or null unless both are there.
 */
export function readIdrContext(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? '')
  const idrId = params.get(IDR)
  const reportId = params.get(REPORT)
  return idrId && reportId ? { idrId, reportId } : null
}

/**
 * Adds the IDR context to a path (keeping its query string and any #hash). Returns the path unchanged without one.
 */
export function withIdrContext(path, context) {
  if (!context?.idrId || !context?.reportId) return path
  const hashAt = path.indexOf('#')
  const base = hashAt === -1 ? path : path.slice(0, hashAt)
  const hash = hashAt === -1 ? '' : path.slice(hashAt)
  const queryAt = base.indexOf('?')
  const params = new URLSearchParams(queryAt === -1 ? '' : base.slice(queryAt + 1))
  params.set(IDR, context.idrId)
  params.set(REPORT, context.reportId)
  return `${queryAt === -1 ? base : base.slice(0, queryAt)}?${params.toString()}${hash}`
}

// The states that count toward an IDR: attributed before approval, claimed once it is approved
const COUNTING = new Set(['attributed', 'claimed'])

/**
 * Sums what one site's flags and curb segments come to for an IDR, per pay item, from its attributed-flags and
 * attributed-segments responses. Only counting ones on the property with an amount in their pay item's unit add.
 * Returns [{key, pay_item_ref, budget_code, description, unit, amount, flags, segments}], by item number then budget code.
 */
export function siteGeometryRows(flags, segments, propertyId) {
  const rows = new Map()
  const add = (drawing, kind) => {
    if (drawing.property_id !== propertyId || !COUNTING.has(drawing.state) || drawing.amount == null) return
    const key = `${drawing.pay_item_ref ?? ''}|${drawing.budget_code ?? ''}`
    const row = rows.get(key) ?? {
      key, pay_item_ref: drawing.pay_item_ref, budget_code: drawing.budget_code,
      description: drawing.pay_item_description, unit: drawing.unit, amount: 0, flags: 0, segments: 0,
    }
    row.amount += Number(drawing.amount)
    row[kind] += 1
    rows.set(key, row)
  }
  for (const flag of flags ?? []) add(flag, 'flags')
  for (const segment of segments ?? []) add(segment, 'segments')
  return [...rows.values()]
    .map(row => ({ ...row, amount: Math.round(row.amount * 100) / 100 }))
    .sort((a, b) => `${a.pay_item_ref} ${a.budget_code}`.localeCompare(`${b.pay_item_ref} ${b.budget_code}`))
}
