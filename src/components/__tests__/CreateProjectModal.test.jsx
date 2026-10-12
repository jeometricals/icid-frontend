import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateProjectModal, {
  MAX_BOROUGH_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_PROJECT_ID_LENGTH, MAX_PROJECT_NAME_LENGTH,
  MAX_REGISTRATION_CODE_LENGTH,
} from '../CreateProjectModal'

function renderModal(props = {}) {
  const onCreate = vi.fn()
  const onCancel = vi.fn()
  render(<CreateProjectModal onCreate={onCreate} onCancel={onCancel} {...props} />)
  return { onCreate, onCancel }
}

const projectId = () => screen.getByLabelText('Project ID')
const name = () => screen.getByLabelText('Project name')
const description = () => screen.getByLabelText('Description')
const borough = () => screen.getByLabelText('Borough')
const registration = () => screen.getByLabelText('Registration code (optional)')
const createButton = () => screen.getByRole('button', { name: 'Create project' })

async function fill({ idText = 'TEST001', nameText = 'Smoke', descriptionText = 'Smoke test', boroughText = 'Manhattan' } = {}) {
  if (idText) await userEvent.type(projectId(), idText)
  if (nameText) await userEvent.type(name(), nameText)
  if (descriptionText) await userEvent.type(description(), descriptionText)
  if (boroughText) await userEvent.type(borough(), boroughText)
}

describe('CreateProjectModal', () => {
  it('opens empty, with every field and Save off', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Create Project' })).toBeInTheDocument()
    for (const input of [projectId(), name(), description(), borough(), registration()]) expect(input).toHaveValue('')
    expect(createButton()).toBeDisabled()
  })

  it('says what a project ID can hold', () => {
    renderModal()
    expect(projectId()).toHaveAccessibleDescription('Letters, digits, hyphens and underscores only.')
  })

  it('caps each field at what the backend takes', () => {
    renderModal()
    expect(projectId()).toHaveAttribute('maxLength', String(MAX_PROJECT_ID_LENGTH))
    expect(name()).toHaveAttribute('maxLength', String(MAX_PROJECT_NAME_LENGTH))
    expect(description()).toHaveAttribute('maxLength', String(MAX_DESCRIPTION_LENGTH))
    expect(borough()).toHaveAttribute('maxLength', String(MAX_BOROUGH_LENGTH))
    expect(registration()).toHaveAttribute('maxLength', String(MAX_REGISTRATION_CODE_LENGTH))
  })

  it.each([
    ['the project ID', { idText: '' }],
    ['the project name', { nameText: '' }],
    ['the description', { descriptionText: '' }],
    ['the borough', { boroughText: '' }],
    ['a project ID that isn\'t only spaces', { idText: '   ' }],
    ['a description that isn\'t only spaces', { descriptionText: '  ' }],
    ['a borough that isn\'t only spaces', { boroughText: '  ' }],
  ])('keeps Save off without %s', async (_, values) => {
    renderModal()
    await fill(values)
    expect(createButton()).toBeDisabled()
  })

  it('turns Save on once every field but the registration code is in', async () => {
    renderModal()
    await fill()
    expect(createButton()).toBeEnabled()
  })

  it('passes on the minimum: no registration code', async () => {
    const { onCreate } = renderModal()
    await fill()
    await userEvent.click(createButton())
    expect(onCreate).toHaveBeenCalledWith({ project_id: 'TEST001', project_name: 'Smoke',
      project_description: 'Smoke test', borough: 'Manhattan', registration_code: '' })
  })

  it('passes on everything, trimmed', async () => {
    const { onCreate } = renderModal()
    await fill({ idText: ' TEST001 ', nameText: ' Smoke ', descriptionText: ' Smoke test ', boroughText: ' Manhattan ' })
    await userEvent.type(registration(), ' 2024123457 ')
    await userEvent.click(createButton())
    expect(onCreate).toHaveBeenCalledWith({ project_id: 'TEST001', project_name: 'Smoke',
      project_description: 'Smoke test', borough: 'Manhattan', registration_code: '2024123457' })
  })

  it('cancels without creating', async () => {
    const { onCreate, onCancel } = renderModal()
    await fill()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('locks itself while the save runs', () => {
    renderModal({ busy: true })
    for (const input of [projectId(), name(), description(), borough(), registration()]) expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('shows why a save failed', () => {
    renderModal({ error: 'A project with this project_id already exists' })
    expect(screen.getByRole('alert')).toHaveTextContent('A project with this project_id already exists')
  })
})
