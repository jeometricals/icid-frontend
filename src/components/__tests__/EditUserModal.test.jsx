import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditUserModal, { MAX_EMAIL_LENGTH, MAX_NAME_LENGTH } from '../EditUserModal'
import { DEMO_USER, TEST_USER } from '../../test/users'

const ADMIN = { ...TEST_USER, role: 'admin' }

function renderModal(props = {}) {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  render(<EditUserModal user={TEST_USER} onSave={onSave} onCancel={onCancel} {...props} />)
  return { onSave, onCancel }
}

const first = () => screen.getByLabelText('First name')
const last = () => screen.getByLabelText('Last name')
const email = () => screen.getByLabelText('Email')
const adminBox = () => screen.getByLabelText('Grant admin role')
const promoteBox = () => screen.queryByLabelText('Promote to real user')
const saveButton = () => screen.getByRole('button', { name: 'Save' })
const confirmDialog = () => screen.queryByRole('dialog', { name: 'Save changes?' })
const confirmLines = () => within(confirmDialog()).getAllByRole('listitem').map(li => li.textContent)
const confirmSave = () => userEvent.click(within(confirmDialog()).getByRole('button', { name: 'Save changes' }))

async function retype(input, text) {
  await userEvent.clear(input)
  if (text) await userEvent.type(input, text)
}

describe('EditUserModal', () => {
  it('opens with both names and the email filled in, and Save off', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Edit User' })).toBeInTheDocument()
    expect(first()).toHaveValue('Genghis')
    expect(last()).toHaveValue('Khan')
    expect(email()).toHaveValue(TEST_USER.email)
    expect(email()).toHaveAttribute('maxLength', String(MAX_EMAIL_LENGTH))
    expect(saveButton()).toBeDisabled()
  })

  it('shows empty fields for a user with no names', () => {
    renderModal({ user: { ...TEST_USER, first_name: null, last_name: null } })
    expect(first()).toHaveValue('')
    expect(last()).toHaveValue('')
  })

  it('caps each name at the length the backend takes', () => {
    renderModal()
    expect(first()).toHaveAttribute('maxLength', String(MAX_NAME_LENGTH))
    expect(last()).toHaveAttribute('maxLength', String(MAX_NAME_LENGTH))
  })

  it('passes on only the name that changed, trimmed', async () => {
    const { onSave } = renderModal()
    await retype(last(), '  Borjigin ')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ last_name: 'Borjigin' })
  })

  it('passes on both names when both changed', async () => {
    const { onSave } = renderModal()
    await retype(first(), 'Temujin')
    await retype(last(), 'Borjigin')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ first_name: 'Temujin', last_name: 'Borjigin' })
  })

  it('treats a name typed back as it was, or only padded, as unchanged', async () => {
    renderModal()
    await retype(last(), ' Khan ')
    expect(saveButton()).toBeDisabled()
  })

  it('refuses an emptied name inline and saves nothing', async () => {
    const { onSave } = renderModal()
    await retype(last(), '   ')
    await userEvent.click(saveButton())
    expect(screen.getByRole('alert')).toHaveTextContent("Last name can't be blank.")
    expect(last()).toHaveAttribute('aria-invalid', 'true')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('clears the inline error once the name is typed again', async () => {
    const { onSave } = renderModal()
    await retype(first(), '')
    await userEvent.click(saveButton())
    expect(screen.getByRole('alert')).toHaveTextContent("First name can't be blank.")
    await userEvent.type(first(), 'Temujin')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ first_name: 'Temujin' })
  })

  it('lets a name that was never set stay empty', async () => {
    const { onSave } = renderModal({ user: { ...TEST_USER, last_name: null } })
    await retype(first(), 'Temujin')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ first_name: 'Temujin' })
  })

  it('cancels without saving', async () => {
    const { onSave, onCancel } = renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('locks itself while the save runs', () => {
    renderModal({ busy: true })
    expect(first()).toBeDisabled()
    expect(last()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('shows why a save failed', () => {
    renderModal({ error: "Couldn't save the user: User not found" })
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save the user: User not found")
  })

  it('saves a name change straight away, with no confirmation', async () => {
    const { onSave } = renderModal()
    await retype(first(), 'Temujin')
    await userEvent.click(saveButton())
    expect(confirmDialog()).not.toBeInTheDocument()
    expect(onSave).toHaveBeenCalledWith({ first_name: 'Temujin' })
  })
})

describe('EditUserModal — the admin role and promotion boxes', () => {
  it('ticks Grant admin role for an admin and not for anyone else', () => {
    const { unmount } = render(<EditUserModal user={ADMIN} onSave={() => {}} onCancel={() => {}} />)
    expect(adminBox()).toBeChecked()
    expect(adminBox()).toBeEnabled()
    unmount()
    renderModal()
    expect(adminBox()).not.toBeChecked()
  })

  it('turns the admin box off, with a tooltip, on the admin\'s own row', async () => {
    const { onSave } = renderModal({ user: ADMIN, isSelf: true })
    expect(adminBox()).toBeChecked()
    expect(adminBox()).toBeDisabled()
    expect(adminBox()).toHaveAttribute('title', 'You cannot change your own admin role.')
    await userEvent.click(adminBox())
    expect(adminBox()).toBeChecked()
    expect(saveButton()).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('has no tooltip on anyone else\'s row', () => {
    renderModal({ user: ADMIN })
    expect(adminBox()).not.toHaveAttribute('title')
  })

  it('offers Promote to real user, unticked, for a demo user only', () => {
    const { unmount } = render(<EditUserModal user={DEMO_USER} onSave={() => {}} onCancel={() => {}} />)
    expect(promoteBox()).toBeInTheDocument()
    expect(promoteBox()).not.toBeChecked()
    unmount()
    renderModal()
    expect(promoteBox()).not.toBeInTheDocument()
  })

  it('locks the email and both boxes while the save runs', () => {
    renderModal({ user: DEMO_USER, busy: true })
    for (const input of [email(), adminBox(), promoteBox()]) expect(input).toBeDisabled()
  })
})

describe('EditUserModal — when Save turns on', () => {
  it('stays off while nothing has changed', () => {
    renderModal({ user: DEMO_USER })
    expect(saveButton()).toBeDisabled()
  })

  it('turns on when the email alone changes, and off again when it is typed back', async () => {
    renderModal()
    await retype(email(), 'khan@magnoleng.pc')
    expect(saveButton()).toBeEnabled()
    await retype(email(), ` ${TEST_USER.email} `)
    expect(saveButton()).toBeDisabled()
  })

  it('turns on when the admin box alone is toggled, and off again when it is put back', async () => {
    renderModal()
    await userEvent.click(adminBox())
    expect(saveButton()).toBeEnabled()
    await userEvent.click(adminBox())
    expect(saveButton()).toBeDisabled()
  })

  it('turns on when Promote to real user is ticked', async () => {
    renderModal({ user: DEMO_USER })
    await userEvent.click(promoteBox())
    expect(saveButton()).toBeEnabled()
  })

  it('refuses an emptied email inline and asks nothing', async () => {
    const { onSave } = renderModal()
    await retype(email(), '  ')
    await userEvent.click(saveButton())
    expect(screen.getByRole('alert')).toHaveTextContent("Email can't be blank.")
    expect(confirmDialog()).not.toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })
})

describe('EditUserModal — confirming a sensitive change', () => {
  it('asks before changing the email, naming the old and the new, then passes it on trimmed', async () => {
    const { onSave } = renderModal()
    await retype(email(), ' khan@magnoleng.pc ')
    await userEvent.click(saveButton())
    expect(confirmDialog()).toBeInTheDocument()
    expect(confirmLines()).toEqual([
      'Change email from KhanG@magnoleng.pc to khan@magnoleng.pc? The user will need to sign in with the new email.',
    ])
    expect(onSave).not.toHaveBeenCalled()
    await confirmSave()
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ email: 'khan@magnoleng.pc' })
    expect(confirmDialog()).not.toBeInTheDocument()
  })

  it('asks before granting the admin role', async () => {
    const { onSave } = renderModal()
    await userEvent.click(adminBox())
    await userEvent.click(saveButton())
    expect(confirmLines()).toEqual(['Grant admin role to KhanG@magnoleng.pc?'])
    await confirmSave()
    expect(onSave).toHaveBeenCalledWith({ is_admin: true })
  })

  it('asks before revoking it', async () => {
    const { onSave } = renderModal({ user: ADMIN })
    await userEvent.click(adminBox())
    await userEvent.click(saveButton())
    expect(confirmLines()).toEqual(['Revoke admin role from KhanG@magnoleng.pc?'])
    await confirmSave()
    expect(onSave).toHaveBeenCalledWith({ is_admin: false })
  })

  it('asks before promoting a demo user, and passes on is_demo false', async () => {
    const { onSave } = renderModal({ user: DEMO_USER })
    await userEvent.click(promoteBox())
    await userEvent.click(saveButton())
    expect(confirmLines()).toEqual([
      `Promote ${DEMO_USER.email} from demo to real user? This stops the demo-cleanup from touching their data.`,
    ])
    await confirmSave()
    expect(onSave).toHaveBeenCalledWith({ is_demo: false })
  })

  it('lists every sensitive change at once, and passes them on with a name changed alongside', async () => {
    const { onSave } = renderModal({ user: DEMO_USER })
    await retype(last(), 'Tester')
    await retype(email(), 'dana@icid.local')
    await userEvent.click(adminBox())
    await userEvent.click(promoteBox())
    await userEvent.click(saveButton())
    expect(within(confirmDialog()).getByText('Please confirm these changes:')).toBeInTheDocument()
    expect(confirmLines()).toEqual([
      `Change email from ${DEMO_USER.email} to dana@icid.local? The user will need to sign in with the new email.`,
      `Grant admin role to ${DEMO_USER.email}?`,
      `Promote ${DEMO_USER.email} from demo to real user? This stops the demo-cleanup from touching their data.`,
    ])
    await confirmSave()
    expect(onSave).toHaveBeenCalledWith({ last_name: 'Tester', email: 'dana@icid.local', is_admin: true, is_demo: false })
  })

  it('returns to the form with everything as it was when the confirmation is cancelled', async () => {
    const { onSave, onCancel } = renderModal({ user: DEMO_USER })
    await retype(first(), 'Dana')
    await retype(email(), 'dana@icid.local')
    await userEvent.click(adminBox())
    await userEvent.click(promoteBox())
    await userEvent.click(saveButton())
    await userEvent.click(within(confirmDialog()).getByRole('button', { name: 'Cancel' }))
    expect(confirmDialog()).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Edit User' })).toBeInTheDocument()
    expect(first()).toHaveValue('Dana')
    expect(email()).toHaveValue('dana@icid.local')
    expect(adminBox()).toBeChecked()
    expect(promoteBox()).toBeChecked()
    expect(saveButton()).toBeEnabled()
    expect(onSave).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('shows a taken email inline once the save is refused, with what was typed still there', async () => {
    const props = { user: TEST_USER, onSave: () => {}, onCancel: () => {} }
    const { rerender } = render(<EditUserModal {...props} />)
    await retype(email(), 'reza@icid.local')
    await userEvent.click(saveButton())
    await confirmSave()
    rerender(<EditUserModal {...props} error="Another user already has this email." />)
    expect(screen.getByRole('dialog', { name: 'Edit User' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Another user already has this email.')
    expect(email()).toHaveValue('reza@icid.local')
    expect(saveButton()).toBeEnabled()
  })
})
