// getIdrFlags responses for tests, shaped as the backend returns them (services/idrFlags.js).

const SIDEWALK = {
  property_kind: 'sidewalk', boro: 'Queens', block: '123', lot: '45', address: '12 Main St',
  intersection_street_1: null, intersection_street_2: null, quadrant: null, facing_street: null,
  display_address: '12 Main St',
}

/** One flag as an IDR lists it: by default flag #1, attributed, 4", 50 SF of pay item 608-01 on a Queens sidewalk. */
export function idrFlag(overrides = {}) {
  return {
    flag_id: 'flag-1',
    pir_id: 'pir-1',
    pir_page_id: 'page-1',
    page_number: 1,
    display_order: 1,
    shape: 'rectangle',
    surveyed_thickness: '4in',
    property_id: 'prop-1',
    ...SIDEWALK,
    pay_item_id: 'ci-1',
    pay_item_ref: '608-01',
    budget_code: 'B100',
    pay_item_description: '4" Concrete Sidewalk',
    unit: 'SF',
    quantity_sf: 50,
    amount: 50,
    state: 'attributed',
    override: null,
    on_imported_site: true,
    claimed_by_idr_id: null,
    claimed_by_idr_number: null,
    is_constructed: false,
    constructed_on: null,
    deleted_at: null,
    ...overrides,
  }
}

/** A ped ramp's site fields, to spread into idrFlag. */
export const PED_RAMP_SITE = {
  property_kind: 'ped_ramp', boro: 'Brooklyn', block: null, lot: null, address: null,
  intersection_street_1: 'Atlantic Ave', intersection_street_2: 'Court St', quadrant: 'NE', facing_street: 'street_2',
  display_address: 'Atlantic Ave & Court St — NE Quadrant (Facing Court St)',
}

/**
 * An IDR's flags: the counts worked out from the flags' states, and the pay items rolled up from the attributed ones
 * (live) unless given. frozen marks an approved IDR's.
 */
export function idrFlagsData(flags = [], { frozen = false, taskOrderId = 'to-1', payItems, unmapped = 0, status = 'draft' } = {}) {
  const counting = frozen ? 'claimed' : 'attributed'
  const counted = flags.filter(flag => flag.state === counting)
  const rolled = payItems ?? Object.values(counted.reduce((lines, flag) => {
    if (!flag.pay_item_id) return lines
    const line = lines[flag.pay_item_id] ?? {
      pay_item_id: frozen ? null : flag.pay_item_id, pay_item_ref: flag.pay_item_ref, budget_code: flag.budget_code,
      description: flag.pay_item_description, unit: flag.unit, amount: 0, flag_count: frozen ? null : 0,
    }
    line.amount += flag.amount ?? 0
    if (!frozen) line.flag_count += 1
    return { ...lines, [flag.pay_item_id]: line }
  }, {}))
  return {
    idr_id: 'idr-1',
    status,
    task_order_id: taskOrderId,
    frozen,
    counts: {
      attributed: counted.length,
      excluded: flags.filter(flag => flag.state === 'excluded').length,
      claimed_elsewhere: flags.filter(flag => flag.state === 'claimed_elsewhere').length,
      total: flags.length,
    },
    flags,
    pay_items: rolled,
    unmapped,
  }
}
