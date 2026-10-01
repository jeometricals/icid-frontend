import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PayItemPicker, { EMPTY_CATALOG_MESSAGE, NO_MATCHES_MESSAGE, catalogEntries } from '../PayItemPicker'
import { MOCK_CONTRACT_ITEMS } from '../../../test/contractItems'

function renderPicker(props = {}) {
  const handlers = { onPick: vi.fn(), onAddManual: vi.fn(), onClose: vi.fn() }
  render(<PayItemPicker items={MOCK_CONTRACT_ITEMS} autoFocus {...handlers} {...props} />)
  return handlers
}

const search = () => screen.getByRole('textbox', { name: 'Search pay items' })
const optionTexts = () => screen.queryAllByRole('option').map(option => option.textContent)

const AB_R = '4.02 AB-R — Asphaltic Concrete Wearing Course, 1-1/2" Thick (S.Y.)'
const AAS = '4.13 AAS — 4" Concrete Sidewalk (Unpigmented) (S.F.)'

describe('catalogEntries', () => {
  it('groups contract items by item no., gathering every budget code', () => {
    expect(catalogEntries(MOCK_CONTRACT_ITEMS)).toEqual([
      { itemNo: '4.02 AB-R', description: 'Asphaltic Concrete Wearing Course, 1-1/2" Thick', payUnit: 'S.Y.', budgetCodes: ['12345'] },
      { itemNo: '4.13 AAS', description: '4" Concrete Sidewalk (Unpigmented)', payUnit: 'S.F.', budgetCodes: ['12345', '67890'] },
    ])
  })
})

describe('PayItemPicker', () => {
  it('renders the search box, the list and the "+ Add manually" button', () => {
    renderPicker()
    expect(search()).toHaveAttribute('placeholder', 'Search by item no. or description…')
    expect(search()).toHaveFocus()
    expect(screen.getByRole('listbox', { name: 'Pay items' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Add manually' })).toBeInTheDocument()
  })

  it('lists each item no. once, however many budget codes it has', () => {
    renderPicker()
    expect(optionTexts()).toEqual([AB_R, AAS])
  })

  it('filters by item no., ignoring case', async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.type(search(), 'ab-r')
    expect(optionTexts()).toEqual([AB_R])
  })

  it('filters by description, ignoring case', async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.type(search(), 'SIDEWALK')
    expect(optionTexts()).toEqual([AAS])
  })

  it('says so when nothing matches', async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.type(search(), 'barrier')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByText(NO_MATCHES_MESSAGE)).toBeInTheDocument()
  })

  it('says the catalog is empty when the project has no contract items', () => {
    renderPicker({ items: [] })
    expect(screen.getByText(EMPTY_CATALOG_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Add manually' })).toBeInTheDocument()
  })

  it('ArrowDown highlights the first entry and Enter picks it', async () => {
    const user = userEvent.setup()
    const { onPick } = renderPicker()
    await user.keyboard('{ArrowDown}')
    const [first] = screen.getAllByRole('option')
    expect(first).toHaveAttribute('aria-selected', 'true')
    expect(search()).toHaveAttribute('aria-activedescendant', first.id)
    await user.keyboard('{Enter}')
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ itemNo: '4.02 AB-R', budgetCodes: ['12345'] }))
  })

  it('ArrowUp moves the highlight back up', async () => {
    const user = userEvent.setup()
    const { onPick } = renderPicker()
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowUp}{Enter}')
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ itemNo: '4.02 AB-R' }))
  })

  it('Escape closes without picking', async () => {
    const user = userEvent.setup()
    const { onPick, onClose } = renderPicker()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
    expect(onPick).not.toHaveBeenCalled()
  })

  it('clicking an entry picks it, with all its budget codes', async () => {
    const user = userEvent.setup()
    const { onPick } = renderPicker()
    await user.click(screen.getByRole('option', { name: AAS }))
    expect(onPick).toHaveBeenCalledWith({
      itemNo: '4.13 AAS', description: '4" Concrete Sidewalk (Unpigmented)', payUnit: 'S.F.', budgetCodes: ['12345', '67890'],
    })
  })

  it('"+ Add manually" calls onAddManual', async () => {
    const user = userEvent.setup()
    const { onAddManual, onClose } = renderPicker()
    await user.click(screen.getByRole('button', { name: '+ Add manually' }))
    expect(onAddManual).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('a click outside closes it', async () => {
    const user = userEvent.setup()
    const { onClose } = renderPicker()
    await user.click(document.body)
    expect(onClose).toHaveBeenCalled()
  })
})
