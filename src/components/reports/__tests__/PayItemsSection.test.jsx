import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PayItemsSection, { CATALOG_UNAVAILABLE } from '../PayItemsSection'
import { MOCK_CONTRACT_ITEMS } from '../../../test/contractItems'

const blankRow = () => ({ itemNo: '', budgetCode: '', payQuantity: '', unit: '', description: '' })

// Holds the pay items in state as useReportForm does, reporting each change to onChange
function StatefulSection({ initial = [], onChange = () => {}, ...props }) {
  const [payItems, setPayItems] = useState(initial)
  const update = (next) => setPayItems(prev => {
    const result = next(prev)
    onChange(result)
    return result
  })
  return (
    <PayItemsSection
      payItems={payItems}
      onAddItem={() => update(prev => [...prev, blankRow()])}
      onItemChange={(index, field, value) => update(prev => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))}
      onRemoveItem={(index) => update(prev => prev.filter((_, i) => i !== index))}
      contractItems={MOCK_CONTRACT_ITEMS}
      {...props}
    />
  )
}

function renderSection(props = {}) {
  const onChange = vi.fn()
  render(<StatefulSection onChange={onChange} {...props} />)
  // The rows as of the last change
  return { rows: () => onChange.mock.calls.at(-1)?.[0] }
}

const addButton = () => screen.getByRole('button', { name: /add item/i })
const picker = () => screen.queryByTestId('pay-item-picker')
const cell = (row, label) => screen.getByLabelText(`Pay item ${row} ${label}`)

describe('PayItemsSection — table', () => {
  it('renders the five columns in order, plus a remove column', () => {
    renderSection()
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual([
      'Item No.', 'Budget Code', 'Pay Quantity', 'Unit', 'Description', 'Remove',
    ])
    expect(screen.getByText(/No pay items added/)).toBeInTheDocument()
  })

  it('shows a row saved before the unit field with an empty Unit cell', () => {
    renderSection({ initial: [{ itemNo: '4.01', budgetCode: 'B7', payQuantity: '12', description: 'Curb' }] })
    expect(cell(1, 'Item No.')).toHaveValue('4.01')
    expect(cell(1, 'Unit')).toHaveValue('')
    expect(cell(1, 'Description')).toHaveValue('Curb')
  })

  it('removes a row', async () => {
    const user = userEvent.setup()
    const { rows } = renderSection({ initial: [{ ...blankRow(), itemNo: 'A' }, { ...blankRow(), itemNo: 'B' }] })
    await user.click(screen.getByRole('button', { name: 'Remove pay item 1' }))
    expect(rows()).toEqual([{ ...blankRow(), itemNo: 'B' }])
    expect(cell(1, 'Item No.')).toHaveValue('B')
  })
})

describe('PayItemsSection — picker', () => {
  it('Add Item appends a row and opens the picker on it, search box focused', async () => {
    const user = userEvent.setup()
    const { rows } = renderSection()
    await user.click(addButton())
    expect(rows()).toEqual([blankRow()])
    expect(picker()).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Search pay items' })).toHaveFocus()
    expect(cell(1, 'Item No.')).toHaveAttribute('aria-expanded', 'true')
  })

  it('picking a single-budget-code item fills Item No., Description, Unit and Budget Code', async () => {
    const user = userEvent.setup()
    const { rows } = renderSection()
    await user.click(addButton())
    await user.click(screen.getByRole('option', { name: /^4\.02 AB-R/ }))
    expect(rows()).toEqual([{
      itemNo: '4.02 AB-R',
      budgetCode: '12345',
      payQuantity: '',
      unit: 'S.Y.',
      description: 'Asphaltic Concrete Wearing Course, 1-1/2" Thick',
    }])
    expect(picker()).not.toBeInTheDocument()
    expect(cell(1, 'Budget Code').tagName).toBe('INPUT')
  })

  it('picking a multi-budget-code item leaves Budget Code to a dropdown of its codes', async () => {
    const user = userEvent.setup()
    const { rows } = renderSection()
    await user.click(addButton())
    await user.click(screen.getByRole('option', { name: /^4\.13 AAS/ }))
    expect(rows()[0]).toMatchObject({ itemNo: '4.13 AAS', budgetCode: '', unit: 'S.F.', description: '4" Concrete Sidewalk (Unpigmented)' })

    const select = cell(1, 'Budget Code')
    expect(select.tagName).toBe('SELECT')
    expect([...select.options].map(o => o.value)).toEqual(['', '12345', '67890'])
    await user.selectOptions(select, '67890')
    expect(rows()[0].budgetCode).toBe('67890')
    expect(cell(1, 'Budget Code')).toHaveValue('67890')
  })

  it("keeps a hand-typed budget code outside the catalog's as an extra dropdown option", () => {
    renderSection({ initial: [{ ...blankRow(), itemNo: '4.13 AAS', budgetCode: 'X1' }] })
    const select = cell(1, 'Budget Code')
    expect([...select.options].map(o => o.value)).toEqual(['', '12345', '67890', 'X1'])
    expect(select).toHaveValue('X1')
  })

  it('picks with the keyboard from the search box', async () => {
    const user = userEvent.setup()
    const { rows } = renderSection()
    await user.click(addButton())
    await user.keyboard('sidewalk{ArrowDown}{Enter}')
    expect(rows()[0].itemNo).toBe('4.13 AAS')
  })

  it('"+ Add manually" closes the picker and leaves the row blank for typing all five fields', async () => {
    const user = userEvent.setup()
    const { rows } = renderSection()
    await user.click(addButton())
    await user.click(screen.getByRole('button', { name: '+ Add manually' }))
    expect(picker()).not.toBeInTheDocument()
    expect(rows()).toEqual([blankRow()])
    expect(cell(1, 'Item No.')).toHaveFocus()

    await user.keyboard('CO-1')
    await user.type(cell(1, 'Budget Code'), 'X9')
    await user.type(cell(1, 'Pay Quantity'), '3')
    await user.type(cell(1, 'Unit'), 'L.S.')
    await user.type(cell(1, 'Description'), 'Change order')
    expect(rows()).toEqual([{ itemNo: 'CO-1', budgetCode: 'X9', payQuantity: '3', unit: 'L.S.', description: 'Change order' }])
  })

  it('clicking Item No. or Description opens the picker; other cells do not', async () => {
    const user = userEvent.setup()
    renderSection({ initial: [blankRow()] })
    await user.click(cell(1, 'Pay Quantity'))
    await user.click(cell(1, 'Unit'))
    await user.click(cell(1, 'Budget Code'))
    expect(picker()).not.toBeInTheDocument()

    await user.click(cell(1, 'Description'))
    expect(picker()).toBeInTheDocument()
    expect(cell(1, 'Description')).toHaveAttribute('aria-expanded', 'true')
    // Opened from the cell, focus stays there so the inspector can keep typing
    expect(cell(1, 'Description')).toHaveFocus()
  })

  it('keeps picked values editable', async () => {
    const user = userEvent.setup()
    const { rows } = renderSection()
    await user.click(addButton())
    await user.click(screen.getByRole('option', { name: /^4\.02 AB-R/ }))
    await user.clear(cell(1, 'Unit'))
    await user.type(cell(1, 'Unit'), 'Ton')
    expect(rows()[0]).toMatchObject({ itemNo: '4.02 AB-R', unit: 'Ton' })
  })

  it('Escape in the search box or a click outside closes it', async () => {
    const user = userEvent.setup()
    renderSection({ initial: [blankRow()] })
    await user.click(addButton())
    await user.keyboard('{Escape}')
    expect(picker()).not.toBeInTheDocument()

    await user.click(cell(1, 'Item No.'))
    expect(picker()).toBeInTheDocument()
    await user.click(cell(1, 'Pay Quantity'))
    expect(picker()).not.toBeInTheDocument()
  })
})

describe('PayItemsSection — catalog states', () => {
  it('when the catalog failed to load: no picker, a notice, and Add Item still appends a blank row', async () => {
    const user = userEvent.setup()
    const { rows } = renderSection({ contractItems: [], contractItemsError: 'Failed to fetch' })
    expect(screen.getByText(CATALOG_UNAVAILABLE)).toBeInTheDocument()
    await user.click(addButton())
    expect(rows()).toEqual([blankRow()])
    expect(picker()).not.toBeInTheDocument()
    await user.click(cell(1, 'Item No.'))
    expect(picker()).not.toBeInTheDocument()
    expect(cell(1, 'Item No.')).not.toHaveAttribute('aria-expanded')
  })

  it('while the catalog loads: Add Item is disabled and says so', () => {
    renderSection({ contractItems: [], contractItemsLoading: true })
    expect(addButton()).toBeDisabled()
    expect(addButton()).toHaveTextContent('Add Item (loading catalog…)')
  })

  it('with an empty catalog the picker offers manual entry', async () => {
    const user = userEvent.setup()
    renderSection({ contractItems: [] })
    await user.click(addButton())
    expect(screen.getByText(/No items in this project's catalog/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Add manually' })).toBeInTheDocument()
  })

  it('read-only: buttons and inputs disabled, no picker, no notice', async () => {
    const user = userEvent.setup()
    renderSection({ initial: [blankRow()], disabled: true, contractItemsError: 'Failed' })
    expect(addButton()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove pay item 1' })).toBeDisabled()
    expect(cell(1, 'Unit')).toBeDisabled()
    expect(screen.queryByText(CATALOG_UNAVAILABLE)).not.toBeInTheDocument()
    await user.click(cell(1, 'Item No.'))
    expect(picker()).not.toBeInTheDocument()
  })
})
