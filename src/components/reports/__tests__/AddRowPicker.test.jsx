import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddRowPicker, { OTHER_OPTION } from '../AddRowPicker'

const OPTIONS = ['Masons', 'Carpenters', 'Teamsters', OTHER_OPTION]

function renderPicker(props = {}) {
  const onPick = vi.fn()
  render(<AddRowPicker options={OPTIONS} onPick={onPick} placeholder="Add trade" {...props} />)
  return { onPick, select: screen.getByRole('combobox', { name: 'Add trade' }) }
}

const optionNames = (select) => within(select).getAllByRole('option').map(o => o.textContent)

describe('AddRowPicker', () => {
  it('lists the placeholder, every option, and "Other (specify)" last', () => {
    const { select } = renderPicker()
    expect(optionNames(select)).toEqual(['Add trade', 'Masons', 'Carpenters', 'Teamsters', 'Other (specify)'])
    expect(select).toHaveValue('')
  })

  it('picking a standard option calls onPick with it and resets to the placeholder', async () => {
    const { onPick, select } = renderPicker()
    await userEvent.selectOptions(select, 'Carpenters')
    expect(onPick).toHaveBeenCalledWith('Carpenters')
    expect(select).toHaveValue('')
    expect(screen.queryByPlaceholderText('Specify')).not.toBeInTheDocument()
  })

  it('picking "Other (specify)" reveals a label input and a disabled Add button, without calling onPick', async () => {
    const { onPick, select } = renderPicker()
    await userEvent.selectOptions(select, OTHER_OPTION)
    expect(screen.getByPlaceholderText('Specify')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    expect(onPick).not.toHaveBeenCalled()
  })

  it('typing a label enables Add, which calls onPick with the trimmed label and hides the input', async () => {
    const { onPick, select } = renderPicker()
    await userEvent.selectOptions(select, OTHER_OPTION)
    await userEvent.type(screen.getByPlaceholderText('Specify'), '  Ironworkers  ')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onPick).toHaveBeenCalledWith('Ironworkers')
    expect(screen.queryByPlaceholderText('Specify')).not.toBeInTheDocument()
    expect(select).toHaveValue('')
  })

  it('choosing the placeholder again hides the Other input', async () => {
    const { select } = renderPicker()
    await userEvent.selectOptions(select, OTHER_OPTION)
    await userEvent.selectOptions(select, '')
    expect(screen.queryByPlaceholderText('Specify')).not.toBeInTheDocument()
  })

  it('hides used labels from the list, but never "Other (specify)"', () => {
    const { select } = renderPicker({ usedLabels: ['Masons', 'Teamsters', OTHER_OPTION, 'Ironworkers'] })
    expect(optionNames(select)).toEqual(['Add trade', 'Carpenters', 'Other (specify)'])
  })

  it('keeps Add disabled while the Other label matches a used label, ignoring case', async () => {
    const { onPick, select } = renderPicker({ usedLabels: ['Masons', 'Ironworkers'] })
    await userEvent.selectOptions(select, OTHER_OPTION)
    const input = screen.getByPlaceholderText('Specify')
    const add = screen.getByRole('button', { name: 'Add' })

    await userEvent.type(input, ' ironWORKERS ')
    expect(add).toBeDisabled()
    await userEvent.clear(input)
    await userEvent.type(input, 'masons')
    expect(add).toBeDisabled()
    await userEvent.type(input, ' crew')
    expect(add).toBeEnabled()
    await userEvent.click(add)
    expect(onPick).toHaveBeenCalledWith('masons crew')
  })

  it('disables the dropdown, the Other input and Add when disabled', async () => {
    const onPick = vi.fn()
    const { rerender } = render(<AddRowPicker options={OPTIONS} onPick={onPick} placeholder="Add trade" />)
    // Reveal the Other input with a valid label first, then switch to disabled
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Add trade' }), OTHER_OPTION)
    await userEvent.type(screen.getByPlaceholderText('Specify'), 'Glaziers')
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled()

    rerender(<AddRowPicker options={OPTIONS} onPick={onPick} placeholder="Add trade" disabled />)
    expect(screen.getByRole('combobox', { name: 'Add trade' })).toBeDisabled()
    expect(screen.getByPlaceholderText('Specify')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })
})
