// A sidewalk's tax-map frontage and where it came from (Slice Y1). tax_map_source is 'mappluto_<DCP's version>'
// ('mappluto_26v2'), 'manual', or, reserved, 'pip_scrape' and 'r1k'; null when there is none.

const NAMED_SOURCES = { manual: 'Manual', pip_scrape: 'PIP', r1k: 'R1k' }

/** Words a tax_map_source as the Construction Report prints it: "MapPLUTO 26v2", "Manual"; null for none. */
export function taxMapSourceLabel(source) {
  if (!source) return null
  if (source.startsWith('mappluto_')) return `MapPLUTO ${source.slice('mappluto_'.length)}`
  return NAMED_SOURCES[source] ?? source
}

/** A frontage in feet as the site's page shows it: "25.00 ft"; null for none. */
export function frontageText(feet) {
  return feet == null ? null : `${Number(feet).toFixed(2)} ft`
}
