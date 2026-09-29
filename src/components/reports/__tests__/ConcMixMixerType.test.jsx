import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConcMixMixerType from '../ConcMixMixerType'

function renderMixer(props = {}) {
  const onChange = vi.fn()
  render(<ConcMixMixerType value={{ type: '', otherLabel: '' }} onChange={onChange} {...props} />)
  return onChange
}

describe('ConcMixMixerType', () => {
  it('renders Ready Mix and Other, neither picked, with no specify box', () => {
    renderMixer()
    expect(screen.getByRole('heading', { name: 'Mixer Type' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Ready Mix' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Other' })).not.toBeChecked()
    expect(screen.queryByLabelText('Other mixer type')).not.toBeInTheDocument()
  })

  it('calls onChange with the whole value when a type is picked', async () => {
    const onChange = renderMixer({ value: { type: '', otherLabel: 'kept' } })
    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: 'Ready Mix' }))
    expect(onChange).toHaveBeenLastCalledWith({ type: 'readyMix', otherLabel: 'kept' })
    await user.click(screen.getByRole('radio', { name: 'Other' }))
    expect(onChange).toHaveBeenLastCalledWith({ type: 'other', otherLabel: 'kept' })
  })

  it('reveals the specify box once Other is picked, showing the saved label', () => {
    renderMixer({ value: { type: 'other', otherLabel: 'Volumetric' } })
    expect(screen.getByRole('radio', { name: 'Other' })).toBeChecked()
    expect(screen.getByLabelText('Other mixer type')).toHaveValue('Volumetric')
  })

  it('hides the specify box for Ready Mix', () => {
    renderMixer({ value: { type: 'readyMix', otherLabel: 'Volumetric' } })
    expect(screen.getByRole('radio', { name: 'Ready Mix' })).toBeChecked()
    expect(screen.queryByLabelText('Other mixer type')).not.toBeInTheDocument()
  })

  it('calls onChange with the typed Other label', async () => {
    const onChange = renderMixer({ value: { type: 'other', otherLabel: '' } })
    await userEvent.setup().type(screen.getByLabelText('Other mixer type'), 'V')
    expect(onChange).toHaveBeenLastCalledWith({ type: 'other', otherLabel: 'V' })
  })

  it('disables the radios and the specify box when disabled', () => {
    renderMixer({ value: { type: 'other', otherLabel: '' }, disabled: true })
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
    expect(screen.getByLabelText('Other mixer type')).toBeDisabled()
  })
})
