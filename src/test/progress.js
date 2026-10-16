// Progress rollups as getProjectProgress and getTaskOrderProgress return them (the response's data), shaped on SE384
// after the R1f walkthrough: every flag on TO-002 claimed by IDR 001.

export const MAIN_ST = 'a1000000-0000-4000-8000-000000000001'
export const ELM_ST = 'a1000000-0000-4000-8000-000000000002'
export const OAK_ST = 'a1000000-0000-4000-8000-000000000003'
export const TO_002 = 'b1000000-0000-4000-8000-000000000002'

const NONE = { quantity: 0, flag_count: 0, value: 0 }

// One pay item of a rollup: every state empty unless given, the live total their sum
export function progressItem(item_no, unit, unit_price, states = {}, extra = {}) {
  const buckets = { approved: NONE, in_flight: NONE, unclaimed: NONE, ...states }
  const sum = key => ['approved', 'in_flight', 'unclaimed'].reduce((total, state) => total + buckets[state][key], 0)
  const live_total = { quantity: sum('quantity'), flag_count: sum('flag_count'), value: sum('value') }
  return {
    pay_item_id: `c1000000-0000-4000-8000-${item_no.replace(/\W/g, '').padEnd(12, '0').slice(0, 12)}`,
    item_no, budget_code: 'SE384-CONS', description: `${item_no} description`, unit, unit_price, ...buckets,
    live_total,
    approved_pct: live_total.quantity ? Math.round((buckets.approved.quantity / live_total.quantity) * 1000) / 10 : null,
    ...extra,
  }
}

export const SIDEWALK = progressItem('4.13 AAS', 'SF', 11.29, { approved: { quantity: 383.44, flag_count: 10, value: 4329.04 } })
export const CONCRETE = progressItem('73.21AC', 'CY', 141.16, { approved: { quantity: 3.006111111, flag_count: 5, value: 424.34 } })

const ALL_APPROVED = { approved_value: 4753.38, live_total_value: 4753.38, approved_pct: 100 }
const NOTHING = { approved_value: 0, live_total_value: 0, approved_pct: null }

// The project's rollup: 100% approved, nothing unmapped
export const PROJECT_PROGRESS = {
  scope: { project_id: 'SE384', task_order_id: null, property_id: null },
  pay_items: [SIDEWALK, CONCRETE],
  unmapped_flag_count: 0,
  unmapped_by_property: [],
  overall: ALL_APPROVED,
}

// Nothing in scope
export const EMPTY_PROGRESS = {
  scope: { project_id: 'SE384', task_order_id: null, property_id: null },
  pay_items: [],
  unmapped_flag_count: 0,
  unmapped_by_property: [],
  overall: NOTHING,
}

// One site's rollup within a task order's
export function siteProgress(property_id, display_address, pay_items, overall = NOTHING, unmapped_flag_count = 0) {
  return { property_id, display_address, pay_items, unmapped_flag_count, overall }
}

// TO-002: five sites, two of them started
export const TASK_ORDER_PROGRESS = {
  ...PROJECT_PROGRESS,
  scope: { project_id: 'SE384', task_order_id: TO_002, property_id: null },
  properties: [
    siteProgress(MAIN_ST, '138-22 227 Street', [SIDEWALK], { approved_value: 4329.04, live_total_value: 4329.04, approved_pct: 100 }),
    siteProgress(ELM_ST, '350 Main St', [CONCRETE], { approved_value: 424.34, live_total_value: 424.34, approved_pct: 100 }),
    siteProgress(OAK_ST, '7 Oak St', []),
    siteProgress('a1000000-0000-4000-8000-000000000004', '9 Pine Rd', []),
    siteProgress('a1000000-0000-4000-8000-000000000005', '11 Ash Ln', []),
  ],
  site_count: 5,
  sites_started: 2,
}
