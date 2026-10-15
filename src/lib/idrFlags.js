// An IDR's flags (R1f) as the IDR page, its review toolbar and the admin's IDR list word them. The data is
// getIdrFlags' (services/idrFlags.js).
import { siteName } from './properties'
import { canEditInReview, isAdmin } from './reviewRoles'
import { FLAG_THICKNESSES } from '../data/flagEnums'

// "1 flag", "18 flags"
export const countOf = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

// An amount as the panel prints it: thousands separated, two decimals at most
export const formatAmount = (value) => Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })

/** The flag's site, named as a site is named everywhere else ("Queens Block 123 Lot 45", a ped ramp's address). */
export const flagSiteName = (flag) => siteName({ ...flag, kind: flag.property_kind })

/**
 * What a flag counts for: its amount in its pay item's unit ("42.5 SF", "4.72 SY"), or, without one it can be
 * measured in, its square feet.
 */
export function flagAmountText(flag) {
  if (flag.amount !== null && flag.amount !== undefined && flag.unit) return `${formatAmount(flag.amount)} ${flag.unit}`
  return `${formatAmount(flag.quantity_sf)} SF`
}

/** "4\" Concrete Sidewalk (608-01)": a flag's pay item, or null for none. */
export function flagPayItemText(flag) {
  if (!flag.pay_item_id) return null
  return [flag.pay_item_ref, flag.pay_item_description].filter(Boolean).join(' — ')
}

/** Where a flag is in the sketch workspace: its PIR page, at its page, with it selected. */
export const sketchLink = (projectId, flag) =>
  `/project/${projectId}/properties/${flag.property_id}/pir?page=${flag.page_number ?? 1}&flag=${flag.flag_id}`

/**
 * Whether the user may exclude and include an IDR's flags, as the backend allows: never a demo user; on a draft its
 * inspector or an admin; in review the reviewer who accepted it at its stage, or an admin (canEditInReview); at any
 * other status (submitted and not yet accepted, approved, deleted) nobody.
 */
export function canChangeIdrFlags(idr, user, roles = []) {
  if (!user || user.is_demo || idr.deleted_at) return false
  if (idr.status === 'draft') return isAdmin(user) || idr.reporter_uuid === user.uuid
  return canEditInReview(idr, user, roles)
}

/** The panel's heading: "Flags attributed (18 of 23)", or once approved "Flags claimed (18)". */
export function flagsHeading(data) {
  if (data.frozen) return `Flags claimed (${data.counts.attributed})`
  return `Flags attributed (${data.counts.attributed} of ${data.counts.total})`
}

/**
 * What approving would claim: the attributed flags, the sites they are on, and their square feet by thickness (in
 * FLAG_THICKNESSES order, those with any).
 */
export function claimSummary(data) {
  const flags = data.flags.filter(flag => flag.state === 'attributed')
  const sites = new Set(flags.map(flag => flag.property_id))
  const byThickness = FLAG_THICKNESSES
    .map(({ value, label }) => ({
      thickness: value,
      label,
      sf: flags.filter(flag => flag.surveyed_thickness === value).reduce((sum, flag) => sum + flag.quantity_sf, 0),
    }))
    .filter(({ sf }) => sf > 0)
  return { flagCount: flags.length, siteCount: sites.size, byThickness }
}

/** "This will claim 18 flags across 4 sites. Total: 420 SF 4\", 180 SF 7\"." (or that it claims none) */
export function claimSentence(summary) {
  if (summary.flagCount === 0) return 'No flags are attributed to this IDR, so approving it claims none.'
  const totals = summary.byThickness.map(({ label, sf }) => `${formatAmount(sf)} SF ${label}`).join(', ')
  const total = totals ? ` Total: ${totals}.` : ''
  return `This will claim ${countOf(summary.flagCount, 'flag')} across ${countOf(summary.siteCount, 'site')}.${total}`
}

/** "This will release 18 flags back to the pool." (or that it releases none) */
export function releaseSentence(count) {
  if (count === 0) return 'It has claimed no flags, so none are released.'
  return `This will release ${countOf(count, 'flag')} back to the pool.`
}
