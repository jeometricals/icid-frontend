import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContractItemPicker from '../ContractItemPicker'
import { MOCK_CONTRACT_ITEMS } from '../../test/contractItems'

// The picker with its value kept, as a form keeps it
function Harness({ initial = null, onChange = () => {} }) {
  const [value, setValue] = useState(initial)
  return (
    <ContractItemPicker
      id="pay-item"
      items={MOCK_CONTRACT_ITEMS}
      value={value}
      onChange={(next) => { setValue(next); onChange(next) }}
    />
  )
}

const options = () => within(screen.getByRole('listbox', { name: 'Pay items' })).getAllByRole('option')

describe('ContractItemPicker', () => {
  it('starts with no pay item and a Choose button', () => {
    render(<Harness />)
    expect(screen.getByText('No pay item')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('lists every contract item with its budget code, and filters by item no. or description, any case', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Choose' }))
    expect(options()).toHaveLength(MOCK_CONTRACT_ITEMS.length)
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search pay items' }), 'aas')
    expect(options().every(option => option.textContent.includes('4.13 AAS'))).toBe(true)
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Search pay items' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search pay items' }), 'WEARING')
    expect(options()).toHaveLength(1)
    expect(options()[0]).toHaveTextContent('4.02 AB-R')
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search pay items' }), 'zzz')
    expect(screen.getByText(/No pay items match/)).toBeInTheDocument()
  })

  it('sets the picked contract item\'s id and shows it, then Clear resets it', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Choose' }))
    await userEvent.click(within(options()[0]).getByRole('button'))
    expect(onChange).toHaveBeenLastCalledWith(MOCK_CONTRACT_ITEMS[0].contract_item_id)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByText(`${MOCK_CONTRACT_ITEMS[0].item_no} — ${MOCK_CONTRACT_ITEMS[0].description}`)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(screen.getByText('No pay item')).toBeInTheDocument()
  })

  it('opens on a pick with Change', () => {
    render(<Harness initial={MOCK_CONTRACT_ITEMS[1].contract_item_id} />)
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument()
    expect(screen.getByText(`${MOCK_CONTRACT_ITEMS[1].item_no} — ${MOCK_CONTRACT_ITEMS[1].description}`)).toBeInTheDocument()
  })
})
