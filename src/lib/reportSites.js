// A report's imported sites (Slice U): the work types, and the description written from them.

// The work done at a site, as the backend names it, with its words
export const WORK_TYPES = [
  { value: 'concrete', label: 'Concrete' },
  { value: 'excavation', label: 'Excavation' },
  { value: 'pavement_restoration', label: 'Pavement Restoration' },
  { value: 'other', label: 'Other' },
]

/** Where a site is, as a description says it: a sidewalk's address, a ped ramp's "NE corner of 38 St/31 Ave". */
export function sitePlace(site) {
  if (site.kind !== 'ped_ramp') return site.address ?? ''
  return `${site.quadrant} corner of ${site.intersection_street_1}/${site.intersection_street_2}`
}

/** One site's sentence, without its full stop: "Sidewalk concrete was placed at 138-22 227 Street". */
export function siteSentence(site) {
  const place = sitePlace(site)
  switch (site.work_type) {
    case 'concrete':
      return `${site.kind === 'ped_ramp' ? 'Ped ramp' : 'Sidewalk'} concrete was placed at ${place}`
    case 'excavation':
      return `Excavation at ${place}`
    case 'pavement_restoration':
      return `Pavement restoration at ${place}`
    default:
      return `${(site.work_type_other ?? '').trim() || 'Work'} at ${place}`
  }
}

/** A report's description written from its sites, in the order given: each site's sentence, joined by ". ", ending "."; '' for none. */
export function descriptionFromSites(sites) {
  return sites.length ? `${sites.map(siteSentence).join('. ')}.` : ''
}

/** A report's name in a message, as the backend words it: "General (page 1)". */
export function reportName(report, label) {
  const name = label + (report.is_auto_generated ? ' (auto-generated)' : '')
  return report.page_number ? `${name} (page ${report.page_number})` : name
}
