import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AttachmentDetailsFields from '../AttachmentDetailsFields'

// Holds the field values the way the modals do, and shows them so tests can read back what was typed
function Harness({ initialName = '', initialDescription = '', disabled = false }) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  return (
    <>
      <AttachmentDetailsFields
        name={name}
        description={description}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        disabled={disabled}
      />
      <output data-testid="values">{JSON.stringify({ name, description })}</output>
    </>
  )
}

const values = () => JSON.parse(screen.getByTestId('values').textContent)

describe('AttachmentDetailsFields', () => {
  it('renders labelled Name and Description fields with their values', () => {
    render(<Harness initialName="Crack at curb" initialDescription="North side" />)
    expect(screen.getByLabelText('Name')).toHaveValue('Crack at curb')
    expect(screen.getByLabelText('Description')).toHaveValue('North side')
  })

  it('reports typing through onNameChange and onDescriptionChange', async () => {
    render(<Harness />)
    await userEvent.type(screen.getByLabelText('Name'), 'Crack')
    await userEvent.type(screen.getByLabelText('Description'), 'North side')
    expect(values()).toEqual({ name: 'Crack', description: 'North side' })
  })

  it('caps Name at 200 and Description at 2000 characters, matching the backend', () => {
    render(<Harness />)
    expect(screen.getByLabelText('Name')).toHaveAttribute('maxLength', '200')
    expect(screen.getByLabelText('Description')).toHaveAttribute('maxLength', '2000')
  })

  it('disables both fields when disabled', () => {
    render(<Harness disabled />)
    expect(screen.getByLabelText('Name')).toBeDisabled()
    expect(screen.getByLabelText('Description')).toBeDisabled()
  })
})
