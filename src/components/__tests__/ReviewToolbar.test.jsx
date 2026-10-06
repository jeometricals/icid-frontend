import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ReviewToolbar from '../ReviewToolbar'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { TaskCountContext } from '../../contexts/TaskCountContext'
import { TEST_USER, UNSIGNED_USER } from '../../test/users'

// The real modal needs a canvas and the signature service; here it is a stand-in that can succeed or be cancelled
vi.mock('../SignatureSetupModal', () => ({
  default: ({ isOpen, onClose, onSuccess }) => (isOpen ? (
    <div role="dialog" aria-label="Set Up Your Signature">
      <button onClick={() => { onSuccess?.(); onClose() }}>finish signature</button>
      <button onClick={onClose}>cancel signature</button>
    </div>
  ) : null),
}))

vi.mock('../../services/api', () => ({
  acceptStage1: vi.fn(),
  approveStage1: vi.fn(),
  acceptStage2: vi.fn(),
  approveStage2: vi.fn(),
  returnIdr: vi.fn(),
}))

const OTHER = '5246b39d-87fe-4e21-92a3-2804c899e8b3'
const ADMIN = { ...TEST_USER, role: 'admin' }
const SUBMITTED = { idr_id: 'idr-1', project_id: 'HWS0023', status: 'submitted', idr_number: null,
  stage1_reviewer_uuid: null, re_reviewer_uuid: null }
const STAGE1_MINE = { ...SUBMITTED, status: 'stage1_review', idr_number: '005', stage1_reviewer_uuid: TEST_USER.uuid }
const STAGE2_OPEN = { ...STAGE1_MINE, status: 'stage2_review', stage1_reviewer_uuid: OTHER }
const STAGE2_MINE = { ...STAGE2_OPEN, re_reviewer_uuid: TEST_USER.uuid }

const httpError = (status, message, body = {}) => Object.assign(new Error(message), { status, body: { detail: message, ...body } })

let onChanged
let refreshTaskCount

let onPayItemsUntouched

function renderToolbar(idr, roles, { user = TEST_USER, disabled = false, reports, fieldEdits } = {}) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user })
  return render(
    <MemoryRouter>
      <TaskCountContext.Provider value={{ total: 0, refresh: refreshTaskCount }}>
        <ReviewToolbar
          idr={idr}
          roles={roles}
          reports={reports}
          fieldEdits={fieldEdits}
          onChanged={onChanged}
          onPayItemsUntouched={onPayItemsUntouched}
          disabled={disabled}
        />
      </TaskCountContext.Provider>
    </MemoryRouter>
  )
}

const toolbar = () => screen.queryByRole('region', { name: 'Review' })
const buttonNames = () => within(toolbar()).getAllByRole('button').map(b => b.textContent)
const button = name => within(toolbar()).getByRole('button', { name })
const dialog = name => screen.queryByRole('dialog', { name })

beforeEach(() => {
  vi.clearAllMocks()
  onChanged = vi.fn().mockResolvedValue(undefined)
  onPayItemsUntouched = vi.fn()
  refreshTaskCount = vi.fn().mockResolvedValue(undefined)
  for (const call of Object.values(api)) call.mockResolvedValue({})
})

// ---------------------------------------------------------------------------
// Which buttons show
// ---------------------------------------------------------------------------

describe('ReviewToolbar — what it offers', () => {
  it('renders nothing for an inspector', () => {
    renderToolbar(SUBMITTED, ['inspector'])
    expect(toolbar()).not.toBeInTheDocument()
  })

  it.each([
    ['a submitted IDR, to an OE', SUBMITTED, ['oe'], ['Accept Task - IDR Check']],
    ['their Stage 1 review, to its reviewer', STAGE1_MINE, ['oe'], ['Approve → RE Review', 'Return to Inspector']],
    ['an unaccepted Stage 2 IDR, to an RE', STAGE2_OPEN, ['re'], ['Accept for RE Review']],
    ['their Stage 2 review, to its RE', STAGE2_MINE, ['re'],
      ['Final Approve & Sign', 'Return to OE', 'Return to Inspector']],
  ])('offers %s', (_, idr, roles, expected) => {
    renderToolbar(idr, roles)
    expect(buttonNames()).toEqual(expected)
  })

  it('explains to another reviewer why there is nothing to do', () => {
    renderToolbar({ ...STAGE1_MINE, stage1_reviewer_uuid: OTHER }, ['oe'])
    expect(toolbar()).toHaveTextContent('Another reviewer accepted this IDR for the IDR check.')
    expect(within(toolbar()).queryAllByRole('button')).toHaveLength(0)
  })

  it('renders nothing on an approved IDR', () => {
    renderToolbar({ ...STAGE2_MINE, status: 'approved' }, ['re'], { user: ADMIN })
    expect(toolbar()).not.toBeInTheDocument()
  })

  it('disables every button while the page is busy', () => {
    renderToolbar(STAGE2_MINE, ['re'], { disabled: true })
    for (const b of within(toolbar()).getAllByRole('button')) expect(b).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Accept Task - IDR Check: the IDR number
// ---------------------------------------------------------------------------

describe('ReviewToolbar — Accept Task - IDR Check', () => {
  it('asks for the IDR number, and Accept stays disabled until one is typed', async () => {
    const user = userEvent.setup()
    renderToolbar(SUBMITTED, ['oe'])
    await user.click(button('Accept Task - IDR Check'))
    const modal = dialog('Accept Task - IDR Check')
    expect(within(modal).getByLabelText('IDR #')).toHaveValue('')
    expect(within(modal).getByRole('button', { name: 'Accept' })).toBeDisabled()
    await user.type(within(modal).getByLabelText('IDR #'), '   ')
    expect(within(modal).getByRole('button', { name: 'Accept' })).toBeDisabled()
    expect(api.acceptStage1).not.toHaveBeenCalled()
  })

  it('accepts with the trimmed number, refreshes the page and closes', async () => {
    const user = userEvent.setup()
    renderToolbar(SUBMITTED, ['oe'])
    await user.click(button('Accept Task - IDR Check'))
    await user.type(screen.getByLabelText('IDR #'), ' 005 ')
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    expect(api.acceptStage1).toHaveBeenCalledWith('idr-1', '005')
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(dialog('Accept Task - IDR Check')).not.toBeInTheDocument()
  })

  it('links to the IDR that already uses the number, and keeps the dialog open', async () => {
    api.acceptStage1.mockRejectedValue(
      httpError(409, 'This IDR number is already in use on this project', { existing_idr_id: 'idr-9' }))
    const user = userEvent.setup()
    renderToolbar(SUBMITTED, ['oe'])
    await user.click(button('Accept Task - IDR Check'))
    await user.type(screen.getByLabelText('IDR #'), '005')
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('This number is already in use on another IDR.')
    expect(within(alert).getByRole('link', { name: 'another IDR' })).toHaveAttribute('href', '/project/HWS0023/idr/idr-9')
    expect(dialog('Accept Task - IDR Check')).toBeInTheDocument()
    expect(screen.getByLabelText('IDR #')).toHaveValue('005') // still there to correct
  })

  it('shows any other failure as it came', async () => {
    api.acceptStage1.mockRejectedValue(httpError(409, 'Only a submitted IDR can be accepted for Stage 1'))
    const user = userEvent.setup()
    renderToolbar(SUBMITTED, ['oe'])
    await user.click(button('Accept Task - IDR Check'))
    await user.type(screen.getByLabelText('IDR #'), '005')
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Only a submitted IDR can be accepted for Stage 1')
    expect(onChanged).toHaveBeenCalledTimes(1) // the page still refreshes: the IDR moved under us
  })

  it('accepts straight away, with no number asked, for a resubmitted IDR that has one', async () => {
    const user = userEvent.setup()
    renderToolbar({ ...SUBMITTED, idr_number: '005' }, ['re'])
    await user.click(button('Accept Task - IDR Check'))
    expect(dialog('Accept Task - IDR Check')).not.toBeInTheDocument()
    expect(api.acceptStage1).toHaveBeenCalledWith('idr-1')
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('cancelling does nothing', async () => {
    const user = userEvent.setup()
    renderToolbar(SUBMITTED, ['oe'])
    await user.click(button('Accept Task - IDR Check'))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(dialog('Accept Task - IDR Check')).not.toBeInTheDocument()
    expect(api.acceptStage1).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Approving
// ---------------------------------------------------------------------------

describe('ReviewToolbar — approving', () => {
  it('confirms, then passes the IDR to Stage 2', async () => {
    const user = userEvent.setup()
    renderToolbar(STAGE1_MINE, ['oe'])
    await user.click(button('Approve → RE Review'))
    expect(api.approveStage1).not.toHaveBeenCalled()
    await user.click(within(dialog('Approve for RE Review')).getByRole('button', { name: 'Approve' }))
    expect(api.approveStage1).toHaveBeenCalledWith('idr-1')
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(dialog('Approve for RE Review')).not.toBeInTheDocument()
  })

  it('accepts for Stage 2 in one click', async () => {
    const user = userEvent.setup()
    renderToolbar(STAGE2_OPEN, ['re'])
    await user.click(button('Accept for RE Review'))
    expect(api.acceptStage2).toHaveBeenCalledWith('idr-1')
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('shows a failed one-click action under the buttons', async () => {
    api.acceptStage2.mockRejectedValue(httpError(403, 'Role required: re'))
    const user = userEvent.setup()
    renderToolbar(STAGE2_OPEN, ['re'])
    await user.click(button('Accept for RE Review'))
    expect(await within(toolbar()).findByRole('alert')).toHaveTextContent('Role required: re')
  })

  it('confirms the final approval, saying it signs, then approves', async () => {
    const user = userEvent.setup()
    renderToolbar(STAGE2_MINE, ['re'])
    await user.click(button('Final Approve & Sign'))
    const confirm = dialog('Final Approve & Sign')
    expect(confirm).toHaveTextContent('Your signature will be stamped on every page of its export.')
    await user.click(within(confirm).getByRole('button', { name: 'Approve & Sign' }))
    expect(api.approveStage2).toHaveBeenCalledWith('idr-1')
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('has a reviewer without a signature set one up first, then confirm', async () => {
    const user = userEvent.setup()
    renderToolbar({ ...STAGE2_MINE, re_reviewer_uuid: UNSIGNED_USER.uuid }, ['re'], { user: UNSIGNED_USER })
    await user.click(button('Final Approve & Sign'))
    expect(dialog('Final Approve & Sign')).not.toBeInTheDocument()
    await user.click(within(dialog('Set Up Your Signature')).getByRole('button', { name: 'finish signature' }))
    expect(dialog('Final Approve & Sign')).toBeInTheDocument()
    expect(api.approveStage2).not.toHaveBeenCalled() // still theirs to confirm
  })

  it('goes no further when the signature setup is cancelled', async () => {
    const user = userEvent.setup()
    renderToolbar(STAGE2_MINE, ['re'], { user: UNSIGNED_USER })
    await user.click(button('Final Approve & Sign'))
    await user.click(screen.getByRole('button', { name: 'cancel signature' }))
    expect(dialog('Final Approve & Sign')).not.toBeInTheDocument()
    expect(dialog('Set Up Your Signature')).not.toBeInTheDocument()
    expect(api.approveStage2).not.toHaveBeenCalled()
  })

  it('keeps the confirmation open with the reason when the approval is refused', async () => {
    api.approveStage2.mockRejectedValue(httpError(502, 'Could not copy the signature for this IDR'))
    const user = userEvent.setup()
    renderToolbar(STAGE2_MINE, ['re'])
    await user.click(button('Final Approve & Sign'))
    await user.click(within(dialog('Final Approve & Sign')).getByRole('button', { name: 'Approve & Sign' }))
    expect(await within(dialog('Final Approve & Sign')).findByRole('alert')).toHaveTextContent(
      'Could not copy the signature for this IDR')
  })
})

// ---------------------------------------------------------------------------
// Returning
// ---------------------------------------------------------------------------

describe('ReviewToolbar — returning', () => {
  it.each([
    ['Return to Inspector', 'inspector', 'Comment for the inspector'],
    ['Return to OE', 'oe', 'Comment for the OE'],
  ])('%s asks for a comment and sends it', async (label, to, fieldLabel) => {
    const user = userEvent.setup()
    renderToolbar(STAGE2_MINE, ['re'])
    await user.click(button(label))
    const modal = dialog(label)
    expect(within(modal).getByRole('button', { name: 'Return' })).toBeDisabled()
    await user.type(within(modal).getByLabelText(fieldLabel), '  check the station  ')
    await user.click(within(modal).getByRole('button', { name: 'Return' }))
    expect(api.returnIdr).toHaveBeenCalledWith('idr-1', { to, comment: 'check the station' })
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(dialog(label)).not.toBeInTheDocument()
  })

  it('will not return on a comment of only spaces', async () => {
    const user = userEvent.setup()
    renderToolbar(STAGE1_MINE, ['oe'])
    await user.click(button('Return to Inspector'))
    await user.type(screen.getByLabelText('Comment for the inspector'), '   ')
    expect(screen.getByRole('button', { name: 'Return' })).toBeDisabled()
    expect(api.returnIdr).not.toHaveBeenCalled()
  })

  it('keeps the comment and shows the reason when the return fails', async () => {
    api.returnIdr.mockRejectedValue(httpError(403, 'Only the reviewer who accepted this IDR can do this'))
    const user = userEvent.setup()
    renderToolbar(STAGE1_MINE, ['oe'])
    await user.click(button('Return to Inspector'))
    await user.type(screen.getByLabelText('Comment for the inspector'), 'fix the quantity')
    await user.click(screen.getByRole('button', { name: 'Return' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Only the reviewer who accepted this IDR can do this')
    expect(screen.getByLabelText('Comment for the inspector')).toHaveValue('fix the quantity')
  })
})

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

describe('ReviewToolbar — an admin', () => {
  it('can act at any review stage without a project role', () => {
    renderToolbar({ ...STAGE1_MINE, stage1_reviewer_uuid: OTHER }, [], { user: ADMIN })
    expect(buttonNames()).toEqual(['Approve → RE Review', 'Return to Inspector'])
  })

  it('must accept at Stage 2 like an RE before Final Approve & Sign shows', () => {
    const { unmount } = renderToolbar(STAGE2_OPEN, [], { user: ADMIN })
    expect(buttonNames()).toEqual(['Accept for RE Review'])
    unmount()
    renderToolbar(STAGE2_MINE, [], { user: ADMIN })
    expect(buttonNames()).toEqual(['Final Approve & Sign', 'Return to OE', 'Return to Inspector'])
  })
})

// ---------------------------------------------------------------------------
// Stage 2: nothing but Accept until this user has accepted
// ---------------------------------------------------------------------------

describe('ReviewToolbar — Final Approve & Sign stays hidden until accepted', () => {
  it.each([
    ['nobody has accepted', STAGE2_OPEN],
    ['another RE has accepted', { ...STAGE2_OPEN, re_reviewer_uuid: OTHER }],
  ])('shows an RE only Accept for RE Review while %s', (_, idr) => {
    renderToolbar(idr, ['re'])
    expect(buttonNames()).toEqual(['Accept for RE Review'])
    expect(screen.queryByRole('button', { name: 'Final Approve & Sign' })).not.toBeInTheDocument() // hidden, not disabled
    expect(screen.queryByRole('button', { name: /Return to/ })).not.toBeInTheDocument()
  })

  it('swaps Accept for the three decisions once the IDR is theirs', () => {
    const { rerender } = renderToolbar(STAGE2_OPEN, ['re'])
    rerender(
      <MemoryRouter>
        <ReviewToolbar idr={STAGE2_MINE} roles={['re']} onChanged={onChanged} />
      </MemoryRouter>
    )
    expect(buttonNames()).toEqual(['Final Approve & Sign', 'Return to OE', 'Return to Inspector'])
  })
})

// ---------------------------------------------------------------------------
// The task count follows every action
// ---------------------------------------------------------------------------

describe('ReviewToolbar — refreshing the task count', () => {
  it('refreshes after an accept', async () => {
    const user = userEvent.setup()
    renderToolbar(STAGE2_OPEN, ['re'])
    await user.click(button('Accept for RE Review'))
    expect(refreshTaskCount).toHaveBeenCalledTimes(1)
  })

  it('refreshes after an approval', async () => {
    const user = userEvent.setup()
    renderToolbar(STAGE1_MINE, ['oe'])
    await user.click(button('Approve → RE Review'))
    expect(refreshTaskCount).not.toHaveBeenCalled() // not until it is confirmed
    await user.click(within(dialog('Approve for RE Review')).getByRole('button', { name: 'Approve' }))
    expect(refreshTaskCount).toHaveBeenCalledTimes(1)
  })

  it('refreshes after a return', async () => {
    const user = userEvent.setup()
    renderToolbar(STAGE1_MINE, ['oe'])
    await user.click(button('Return to Inspector'))
    await user.type(screen.getByLabelText('Comment for the inspector'), 'fix it')
    await user.click(screen.getByRole('button', { name: 'Return' }))
    expect(refreshTaskCount).toHaveBeenCalledTimes(1)
  })

  it('refreshes after a refused action too, since the IDR may have moved', async () => {
    api.acceptStage2.mockRejectedValue(httpError(409, 'IDR changed during review; reload and try again'))
    const user = userEvent.setup()
    renderToolbar(STAGE2_OPEN, ['re'])
    await user.click(button('Accept for RE Review'))
    await within(toolbar()).findByRole('alert')
    expect(refreshTaskCount).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Pay items still waiting on the reviewer
// ---------------------------------------------------------------------------

describe('ReviewToolbar — un-approved pay items', () => {
  const item = (id, quantity) => ({ id, itemNo: `no-${id}`, budgetCode: '12345', payQuantity: quantity })
  const REPORTS = [
    { report_id: 'rep-auto', report_type: 'GEN', is_auto_generated: true, report_data: { payItems: [item('auto', '1')] } },
    { report_id: 'rep-1', report_type: 'SWCB', is_auto_generated: false, report_data: { payItems: [item('a', '60.00'), item('b', '29.00')] } },
    { report_id: 'rep-2', report_type: 'AC', is_auto_generated: false, report_data: { payItems: [item('c', '5')] } },
  ]
  const approved = (n, reportId, itemId, quantity, overrides = {}) => ({
    edit_id: `app-${n}`, report_id: reportId, field_path: `payItems[${itemId}]`, edit_type: 'pay_item_approve',
    old_value: quantity, new_value: quantity, editor_uuid: TEST_USER.uuid, editor_stage: 'stage1', ...overrides,
  })
  const GATE = '2 pay items still need your approval or revision before you can approve this IDR'
  const UNTOUCHED = [
    { pay_item_id: 'b', report_id: 'rep-1', item_no: 'no-b', budget_code: '12345' },
    { pay_item_id: 'c', report_id: 'rep-2', item_no: 'no-c', budget_code: '12345' },
  ]
  const approveButton = () => within(toolbar()).getByRole('button', { name: /^Approve → RE Review/ })
  const finalButton = () => within(toolbar()).getByRole('button', { name: /^Final Approve & Sign/ })

  it('counts every pay item the reviewer has not touched, leaving out an auto-generated General', () => {
    renderToolbar(STAGE1_MINE, ['oe'], { reports: REPORTS, fieldEdits: [] })
    expect(approveButton()).toHaveTextContent('3 un-approved items')
    expect(approveButton()).toBeEnabled()
  })

  it('drops as items are approved, reads "1 un-approved item" at one, and goes at none', () => {
    const { unmount } = renderToolbar(STAGE1_MINE, ['oe'], {
      reports: REPORTS, fieldEdits: [approved(1, 'rep-1', 'a', '60.00'), approved(2, 'rep-1', 'b', '29.00')],
    })
    expect(approveButton()).toHaveTextContent(/1 un-approved item$/)
    unmount()
    renderToolbar(STAGE1_MINE, ['oe'], {
      reports: REPORTS,
      fieldEdits: [approved(1, 'rep-1', 'a', '60.00'), approved(2, 'rep-1', 'b', '29.00'), approved(3, 'rep-2', 'c', '5')],
    })
    expect(approveButton()).toHaveTextContent(/^Approve → RE Review$/)
  })

  it('counts afresh for the RE at Stage 2: the OE\'s approvals are not theirs', () => {
    renderToolbar(STAGE2_MINE, ['re'], {
      reports: REPORTS,
      fieldEdits: [
        approved(1, 'rep-1', 'a', '60.00', { editor_uuid: OTHER }), approved(2, 'rep-1', 'b', '29.00', { editor_uuid: OTHER }),
        approved(3, 'rep-2', 'c', '5', { editor_uuid: OTHER }), approved(4, 'rep-1', 'a', '60.00', { editor_stage: 'stage2' }),
      ],
    })
    expect(finalButton()).toHaveTextContent('2 un-approved items')
    expect(within(toolbar()).getByRole('button', { name: 'Return to OE' })).not.toHaveTextContent('un-approved')
  })

  it('shows no count before the reviewer has accepted at Stage 2', () => {
    renderToolbar(STAGE2_OPEN, ['re'], { reports: REPORTS, fieldEdits: [] })
    expect(button('Accept for RE Review')).not.toHaveTextContent('un-approved')
  })

  it('on the backend\'s refusal: closes the dialog, shows its reason as a toast and hands over the untouched items', async () => {
    api.approveStage1.mockRejectedValue(httpError(400, GATE, { untouched: UNTOUCHED }))
    const user = userEvent.setup()
    renderToolbar(STAGE1_MINE, ['oe'], { reports: REPORTS, fieldEdits: [approved(1, 'rep-1', 'a', '60.00')] })
    await user.click(approveButton())
    await user.click(within(dialog('Approve for RE Review')).getByRole('button', { name: 'Approve' }))
    expect(await screen.findByRole('status')).toHaveTextContent(GATE)
    expect(dialog('Approve for RE Review')).not.toBeInTheDocument()
    expect(within(toolbar()).queryByRole('alert')).not.toBeInTheDocument()
    expect(onPayItemsUntouched).toHaveBeenCalledWith({ detail: GATE, untouched: UNTOUCHED })
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('leaves out what the reviewer attested to before the stage was last accepted, from the first paint', () => {
    // Accepted again on Oct 5; the approvals of a and b are from the round before, c's is from this one
    const idr = { ...STAGE1_MINE, stage1_accepted_at: '2026-10-05T14:00:00Z', stage2_accepted_at: null }
    renderToolbar(idr, ['oe'], {
      reports: REPORTS,
      fieldEdits: [
        approved(1, 'rep-1', 'a', '60.00', { edited_at: '2026-10-01T09:00:00Z' }),
        approved(2, 'rep-1', 'b', '29.00', { edited_at: '2026-10-01T09:05:00Z' }),
        approved(3, 'rep-2', 'c', '5', { edited_at: '2026-10-05T15:00:00Z' }),
      ],
    })
    expect(approveButton()).toHaveTextContent('2 un-approved items')
  })

  it('uses the Stage 2 accepted time at Stage 2', () => {
    const idr = { ...STAGE2_MINE, stage1_accepted_at: '2026-10-01T08:00:00Z', stage2_accepted_at: '2026-10-06T10:00:00Z' }
    const at = (n, itemId, reportId, quantity, editedAt) =>
      approved(n, reportId, itemId, quantity, { editor_stage: 'stage2', edited_at: editedAt })
    renderToolbar(idr, ['re'], {
      reports: REPORTS,
      fieldEdits: [
        at(1, 'a', 'rep-1', '60.00', '2026-10-03T09:00:00Z'), // after Stage 1 was accepted, before Stage 2 was: an earlier round
        at(2, 'b', 'rep-1', '29.00', '2026-10-06T10:30:00Z'),
        at(3, 'c', 'rep-2', '5', '2026-10-06T10:31:00Z'),
      ],
    })
    expect(finalButton()).toHaveTextContent(/1 un-approved item$/)
  })

  it('counts every attestation when the IDR carries no accepted time', () => {
    const idr = { ...STAGE1_MINE, stage1_accepted_at: null, stage2_accepted_at: null }
    renderToolbar(idr, ['oe'], {
      reports: REPORTS,
      fieldEdits: [
        approved(1, 'rep-1', 'a', '60.00', { edited_at: '2020-01-01T00:00:00Z' }),
        approved(2, 'rep-1', 'b', '29.00', { edited_at: '2020-01-01T00:00:00Z' }),
        approved(3, 'rep-2', 'c', '5', { edited_at: '2020-01-01T00:00:00Z' }),
      ],
    })
    expect(approveButton()).toHaveTextContent(/^Approve → RE Review$/)
  })

  it('treats any other 400 as an ordinary error', async () => {
    api.approveStage2.mockRejectedValue(httpError(400, 'Signature required before approving'))
    const user = userEvent.setup()
    renderToolbar(STAGE2_MINE, ['re'], { reports: [], fieldEdits: [] })
    await user.click(finalButton())
    await user.click(within(dialog('Final Approve & Sign')).getByRole('button', { name: 'Approve & Sign' }))
    expect(await within(dialog('Final Approve & Sign')).findByRole('alert')).toHaveTextContent('Signature required before approving')
    expect(onPayItemsUntouched).not.toHaveBeenCalled()
  })
})
