import { useCallback } from 'react'
import usePayItemSources from './usePayItemSources'
import useIdrGeometry from './useIdrGeometry'
import { siteGeometryRows } from './idrSiteContext'

/**
 * A report's imported sites' pay items (Slice X), for its Imported sites card and its Pay Items card: the IDR's pay
 * items by source (usePayItemSources) and its attributed flags and curb segments (useIdrGeometry), read together.
 * Takes the IDR's and the report's ids and the report's sites (useReportSites' rows).
 * Returns {sources, geometry, sitePayItems, siteRows, reload()}:
 * - sitePayItems: site id → its rows, [{amount, unit}]: what its flags, then its curb segments, come to for this IDR (as
 *   its own page's table counts them), then the pay items entered on it;
 * - siteRows: the same summed per pay item over the report's sites, [{key, pay_item_ref, budget_code, description,
 *   unit, amount, sites: [{site, amount}]}], by item number then budget code;
 * - reload(): reads both again (after a site is imported or removed).
 */
export default function useReportSitePayItems(idrId, reportId, sites) {
  const sources = usePayItemSources(idrId, reportId)
  const geometry = useIdrGeometry(idrId)
  const { reload: reloadSources } = sources
  const { reload: reloadGeometry } = geometry
  const reload = useCallback(() => { reloadSources(); reloadGeometry() }, [reloadSources, reloadGeometry])

  const sitePayItems = {}
  const byKey = new Map()
  const add = (site, row) => {
    const key = `${row.pay_item_ref ?? ''}|${row.budget_code ?? ''}`
    const entry = byKey.get(key) ?? {
      key, pay_item_ref: row.pay_item_ref, budget_code: row.budget_code, description: row.description, unit: row.unit,
      amount: 0, sites: [],
    }
    entry.amount += Number(row.amount)
    const part = entry.sites.find(s => s.site.id === site.id)
    if (part) part.amount += Number(row.amount)
    else entry.sites.push({ site, amount: Number(row.amount) })
    byKey.set(key, entry)
  }

  for (const site of sites) {
    const auto = siteGeometryRows(geometry.flags, geometry.segments, site.property_id)
    sitePayItems[site.id] = [...auto.filter(row => row.flags), ...auto.filter(row => !row.flags)]
      .map(row => ({ amount: row.amount, unit: row.unit }))
    for (const row of auto) add(site, row)
  }
  for (const item of sources.data?.pay_items ?? []) {
    for (const line of item.site_lines) {
      (sitePayItems[line.site_id] ??= []).push({ amount: line.amount, unit: item.unit })
      const site = sites.find(s => s.id === line.site_id)
      if (site) add(site, { ...item, amount: line.amount })
    }
  }

  const siteRows = [...byKey.values()]
    .map(row => ({ ...row, amount: Math.round(row.amount * 100) / 100 }))
    .sort((a, b) => `${a.pay_item_ref} ${a.budget_code}`.localeCompare(`${b.pay_item_ref} ${b.budget_code}`))

  return { sources, geometry, sitePayItems, siteRows, reload }
}
