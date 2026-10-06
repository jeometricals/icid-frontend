import { describe, it, expect } from 'vitest'
import {
  STATUS_LABELS, countBadgeText, isAdmin, isTaskFor, reviewActionsFor, reviewQueuesFor,
} from '../reviewRoles'
import { DEMO_USER, TEST_USER } from '../../test/users'

const ADMIN = { ...TEST_USER, role: 'admin' }
const OTHER = '5246b39d-87fe-4e21-92a3-2804c899e8b3'
const DECIDE = ['approve-stage2', 'return-oe', 'return-inspector']

const idr = overrides => ({ status: 'submitted', stage1_reviewer_uuid: null, re_reviewer_uuid: null, ...overrides })
const actions = (overrides, user, roles) => reviewActionsFor(idr(overrides), user, roles).actions
const ids = queues => queues.map(q => q.id)

describe('isAdmin', () => {
  it('is true only for the admin role', () => {
    expect(isAdmin(ADMIN)).toBe(true)
    expect(isAdmin(TEST_USER)).toBe(false)
    expect(isAdmin({ ...TEST_USER, role: 'Admin' })).toBe(false)
    expect(isAdmin(null)).toBe(false)
  })
})

describe('STATUS_LABELS', () => {
  it('names every status an IDR can be listed in', () => {
    expect(Object.keys(STATUS_LABELS)).toEqual(['draft', 'submitted', 'stage1_review', 'stage2_review', 'approved'])
  })
})

describe('reviewQueuesFor', () => {
  it('gives an inspector no queue', () => {
    expect(reviewQueuesFor(TEST_USER, { HWS0023: ['inspector'] })).toEqual([])
    expect(reviewQueuesFor(DEMO_USER, { DEMO01: ['inspector'] })).toEqual([])
  })

  it('gives an OE the Stage 1 queue, which holds submitted IDRs as well as those in Stage 1 review', () => {
    const queues = reviewQueuesFor(TEST_USER, { HWS0023: ['inspector'], SE384: ['oe'] })
    expect(ids(queues)).toEqual(['stage1'])
    expect(queues[0].statuses).toEqual(['submitted', 'stage1_review'])
  })

  it('gives an RE both queues', () => {
    const queues = reviewQueuesFor(TEST_USER, { HWS0023: ['re'] })
    expect(ids(queues)).toEqual(['stage1', 'stage2'])
    expect(queues[1].statuses).toEqual(['stage2_review'])
  })

  it('gives an admin both queues without any project role', () => {
    expect(ids(reviewQueuesFor(ADMIN, {}))).toEqual(['stage1', 'stage2'])
  })

  it('treats roles that have not loaded as none', () => {
    expect(reviewQueuesFor(TEST_USER, null)).toEqual([])
    expect(reviewQueuesFor(TEST_USER, undefined)).toEqual([])
  })
})

describe('reviewActionsFor — a submitted IDR', () => {
  it.each([[['oe']], [['re']], [['inspector', 'oe']]])('lets %j accept it for Stage 1', (roles) => {
    expect(actions({}, TEST_USER, roles)).toEqual(['accept-stage1'])
  })

  it('offers an inspector nothing', () => {
    expect(reviewActionsFor(idr({}), TEST_USER, ['inspector'])).toEqual({ actions: [], note: null })
    expect(reviewActionsFor(idr({}), TEST_USER)).toEqual({ actions: [], note: null })
  })

  it('lets an admin accept it', () => {
    expect(actions({}, ADMIN, [])).toEqual(['accept-stage1'])
  })
})

describe('reviewActionsFor — Stage 1 review', () => {
  const mine = { status: 'stage1_review', stage1_reviewer_uuid: TEST_USER.uuid }
  const theirs = { status: 'stage1_review', stage1_reviewer_uuid: OTHER }

  it('lets the reviewer who accepted approve it or return it to the inspector', () => {
    expect(actions(mine, TEST_USER, ['oe'])).toEqual(['approve-stage1', 'return-inspector'])
    expect(actions(mine, TEST_USER, ['re'])).toEqual(['approve-stage1', 'return-inspector'])
  })

  it('never offers a return to the OE from Stage 1', () => {
    expect(actions(mine, TEST_USER, ['re'])).not.toContain('return-oe')
  })

  it('tells another reviewer on the project why they have nothing to do', () => {
    expect(reviewActionsFor(idr(theirs), TEST_USER, ['oe'])).toEqual({
      actions: [], note: 'Another reviewer accepted this IDR for the IDR check.',
    })
  })

  it('offers the accepting reviewer nothing once they no longer review on the project', () => {
    expect(reviewActionsFor(idr(mine), TEST_USER, ['inspector'])).toEqual({ actions: [], note: null })
  })

  it('lets an admin stand in for the reviewer', () => {
    expect(actions(theirs, ADMIN, [])).toEqual(['approve-stage1', 'return-inspector'])
  })
})

describe('reviewActionsFor — Stage 2 review', () => {
  const unaccepted = { status: 'stage2_review', stage1_reviewer_uuid: OTHER }
  const mine = { ...unaccepted, re_reviewer_uuid: TEST_USER.uuid }
  const theirs = { ...unaccepted, re_reviewer_uuid: OTHER }

  it('lets an RE accept an IDR nobody has picked up', () => {
    expect(reviewActionsFor(idr(unaccepted), TEST_USER, ['re'])).toEqual({ actions: ['accept-stage2'], note: null })
  })

  it('lets the RE who accepted approve it, return it to the OE or return it to the inspector', () => {
    expect(reviewActionsFor(idr(mine), TEST_USER, ['re'])).toEqual({ actions: DECIDE, note: null })
  })

  it('lets another RE take it over, and says so', () => {
    expect(reviewActionsFor(idr(theirs), TEST_USER, ['re'])).toEqual({
      actions: ['accept-stage2'], note: 'Another RE has accepted this IDR. Accepting takes it over.',
    })
  })

  it('offers an OE nothing, even the one who reviewed it at Stage 1', () => {
    const reviewedByMe = { ...unaccepted, stage1_reviewer_uuid: TEST_USER.uuid }
    expect(reviewActionsFor(idr(reviewedByMe), TEST_USER, ['inspector', 'oe'])).toEqual({ actions: [], note: null })
  })

  it('hides approving and returning until the user has accepted, for an RE and for an admin', () => {
    for (const [user, roles] of [[TEST_USER, ['re']], [ADMIN, []]]) {
      expect(actions(unaccepted, user, roles)).toEqual(['accept-stage2'])
      expect(actions(theirs, user, roles)).toEqual(['accept-stage2'])
      expect(actions(mine, user, roles)).toEqual(DECIDE)
    }
  })
})

describe('reviewActionsFor — outside review', () => {
  it.each(['draft', 'approved', 'deleted'])('offers nothing on a %s IDR, even to an admin', (status) => {
    expect(reviewActionsFor(idr({ status }), ADMIN, ['oe', 're'])).toEqual({ actions: [], note: null })
  })
})

describe('reviewQueuesFor — the names shown', () => {
  it('calls the queues the IDR Check Queue and the RE Review Queue', () => {
    expect(reviewQueuesFor(ADMIN, {}).map(q => q.label)).toEqual(['IDR Check Queue', 'RE Review Queue'])
  })
})

describe('isTaskFor', () => {
  const submitted = idr({ status: 'submitted' })
  const stage1Mine = idr({ status: 'stage1_review', stage1_reviewer_uuid: TEST_USER.uuid })
  const stage1Theirs = idr({ status: 'stage1_review', stage1_reviewer_uuid: OTHER })
  const stage2Open = idr({ status: 'stage2_review', stage1_reviewer_uuid: OTHER })
  const stage2Mine = { ...stage2Open, re_reviewer_uuid: TEST_USER.uuid }
  const stage2Theirs = { ...stage2Open, re_reviewer_uuid: OTHER }
  const ALL = [submitted, stage1Mine, stage1Theirs, stage2Open, stage2Mine, stage2Theirs]
  const tasks = (user, roles) => ALL.filter(row => isTaskFor(row, user, roles))

  it('counts for an OE: submitted IDRs, and the Stage 1 reviews they accepted', () => {
    expect(tasks(TEST_USER, ['oe'])).toEqual([submitted, stage1Mine])
    expect(tasks(TEST_USER, ['inspector', 'oe'])).toEqual([submitted, stage1Mine])
  })

  it('counts for an RE: those, plus Stage 2 reviews they accepted or nobody has yet', () => {
    expect(tasks(TEST_USER, ['re'])).toEqual([submitted, stage1Mine, stage2Open, stage2Mine])
  })

  it('counts nothing for an inspector, or for no roles at all', () => {
    expect(tasks(TEST_USER, ['inspector'])).toEqual([])
    expect(tasks(TEST_USER)).toEqual([])
  })

  it('counts every IDR in a review queue for an admin', () => {
    expect(tasks(ADMIN, [])).toEqual(ALL)
  })

  it('never counts an IDR outside review', () => {
    for (const status of ['draft', 'approved', 'deleted']) {
      expect(isTaskFor(idr({ status }), ADMIN, ['oe', 're'])).toBe(false)
      expect(isTaskFor(idr({ status }), TEST_USER, ['oe', 're'])).toBe(false)
    }
  })
})

describe('countBadgeText', () => {
  it.each([[0, null], [undefined, null], [-1, null], [1, '1'], [42, '42'], [99, '99'], [100, '99+'], [2500, '99+']])(
    'shows %s as %s', (count, text) => {
      expect(countBadgeText(count)).toBe(text)
    })
})
