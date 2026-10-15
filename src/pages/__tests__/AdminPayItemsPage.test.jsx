import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AdminPayItemsPage from '../AdminPayItemsPage'
import { formatPayItemQuantity, formatUnitPrice } from '../../lib/payItemFormat'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

// ---------------------------------------------------------------------------
// Shared mocks: a tiny in-memory "server", so the list read after a change shows what the backend wrote
// ---------------------------------------------------------------------------

const ADMIN = { ...TEST_USER, role: 'admin' }
const PROJECTS = [
  { project_id: 'HWS0023', project_name: 'S/W Queens 2025' },
  { project_id: 'SE384', project_name: 'Sewer Rehab' },
]
const LONG_DESCRIPTION = 'Furnishing, delivering and installing detectable warning units on pedestrian ramps, complete'

const item = (number, pay_item_ref, budget_code, description, unit, quantity, unit_price) => ({
  pay_item_uuid: `b0000000-0000-4000-8000-00000000000${number}`, pay_item_ref, budget_code, description, unit,
  quantity, unit_price, spec_section: null,
})
// As the backend lists them: by budget code, then ref
const LISTED = [
  item(1, '6.02', 'EP0007-CONS', 'Steel faced curb', 'LF', 171.5, 42.25),
  item(2, '4.13 AAS', 'HW0001Q-CONS', '4" concrete sidewalk', 'SF', 12500, 9.5),
  item(3, '7.13 B', 'HW0001Q-CONS', LONG_DESCRIPTION, 'SF', 1234.5678, 1250),
]
const byBudgetCodeThenRef = (a, b) => a.budget_code.localeCompare(b.budget_code) || a.pay_item_ref.localeCompare(b.pay_item_ref)

vi.mock('../../services/api', () => ({
  listProjectPayItems: vi.fn(), listAdminProjects: vi.fn(), createProjectPayItem: vi.fn(),
  updateProjectPayItem: vi.fn(), deleteProjectPayItem: vi.fn(), clearProjectPayItems: vi.fn(),
  previewPayItemImport: vi.fn(), commitPayItemImport: vi.fn(), setAssessmentRates: vi.fn(),
}))

let server

beforeEach(() => {
  vi.clearAllMocks()
  server = structuredClone(LISTED)
  api.listAdminProjects.mockResolvedValue(PROJECTS)
  api.listProjectPayItems.mockImplementation(async () => structuredClone(server))
  api.createProjectPayItem.mockImplementation(async (projectId, values) => {
    const created = { ...values, pay_item_uuid: 'b0000000-0000-4000-8000-000000000009', spec_section: null }
    server = [...server, created].sort(byBudgetCodeThenRef)
    return created
  })
  api.updateProjectPayItem.mockImplementation(async (projectId, uuid, values) => {
    server = server.map(row => (row.pay_item_uuid === uuid ? { ...row, ...values } : row)).sort(byBudgetCodeThenRef)
    return server.find(row => row.pay_item_uuid === uuid)
  })
  api.deleteProjectPayItem.mockImplementation(async (projectId, uuid) => {
    server = server.filter(row => row.pay_item_uuid !== uuid)
  })
  api.clearProjectPayItems.mockImplementation(async () => {
    const deleted_count = server.length
    server = []
    return { deleted_count }
  })
})

function CurrentUrl() {
  return <div data-testid="url">{useLocation().pathname}</div>
}

function renderPage(user = ADMIN, projectId = 'HWS0023') {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user })
  return render(
    <MemoryRouter initialEntries={[`/admin/projects/${projectId}/pay-items`]}>
      <Routes>
        <Route path="/admin/projects/:projectId/pay-items" element={<AdminPayItemsPage />} />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
}

const ready = () => screen.findByRole('table')
const rows = () => screen.getAllByRole('row').slice(1)
const refs = () => rows().map(row => within(row).getAllByRole('cell')[0].textContent)
const rowFor = (ref) => rows().find(row => within(row).getAllByRole('cell')[0].textContent === ref)
const cells = (ref) => within(rowFor(ref)).getAllByRole('cell').map(cell => cell.textContent)
const dialog = () => screen.queryByRole('dialog')
const banner = () => screen.queryByRole('status')
const addButton = () => screen.getByRole('button', { name: 'Add pay item' })
const clearButton = () => screen.getByRole('button', { name: 'Clear all pay items' })
const inDialog = (name) => within(dialog()).getByRole('button', { name })
const rowButton = (ref, name) => within(rowFor(ref)).getByRole('button', { name })
const EMPTY = 'No pay items yet for this project. Click Add pay item to add one manually, or Import CSV to '
  + 'bulk-seed from a file.'

async function fillIn({ ref = '10.02', budgetCode = 'EP0007-CONS', description = 'Asphaltic concrete', unit = 'TN',
  quantity = '3.2', unitPrice = '185' } = {}) {
  await userEvent.type(within(dialog()).getByLabelText('Pay Item Ref'), ref)
  await userEvent.type(within(dialog()).getByLabelText('Budget Code'), budgetCode)
  await userEvent.type(within(dialog()).getByLabelText('Description'), description)
  await userEvent.type(within(dialog()).getByLabelText('Unit'), unit)
  await userEvent.type(within(dialog()).getByLabelText('Quantity'), quantity)
  await userEvent.type(within(dialog()).getByLabelText('Unit Price'), unitPrice)
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

describe('AdminPayItemsPage — the table', () => {
  it('reads the project\'s pay items once and lists them in the backend\'s order', async () => {
    renderPage()
    await ready()
    expect(api.listProjectPayItems).toHaveBeenCalledTimes(1)
    expect(api.listProjectPayItems).toHaveBeenCalledWith('HWS0023')
    expect(refs()).toEqual(['6.02', '4.13 AAS', '7.13 B']) // by budget code, then ref
  })

  it('names the project in the heading', async () => {
    renderPage()
    await ready()
    expect(screen.getByRole('heading', { name: 'Pay Items — HWS0023 S/W Queens 2025' })).toBeInTheDocument()
  })

  it('has the columns, with Actions last', async () => {
    renderPage()
    await ready()
    expect(screen.getAllByRole('columnheader').map(th => th.textContent))
      .toEqual(['Pay Item Ref', 'Description', 'Unit', 'Quantity', 'Unit Price', 'Budget Code', 'Actions'])
  })

  it('shows each item, the amounts with thousands separators', async () => {
    renderPage()
    await ready()
    expect(cells('6.02').slice(0, 6)).toEqual(['6.02', 'Steel faced curb', 'LF', '171.5', '$42.25', 'EP0007-CONS'])
    expect(cells('4.13 AAS').slice(0, 6))
      .toEqual(['4.13 AAS', '4" concrete sidewalk', 'SF', '12,500', '$9.50', 'HW0001Q-CONS'])
    expect(cells('7.13 B').slice(3, 5)).toEqual(['1,234.568', '$1,250.00'])
    expect(within(rowFor('6.02')).getAllByRole('button').map(button => button.textContent)).toEqual(['Edit', 'Delete'])
  })

  it('prints a quantity with three decimals at most and a price with two', () => {
    expect([0, 0.1 + 0.2, 1234567.8912].map(formatPayItemQuantity)).toEqual(['0', '0.3', '1,234,567.891'])
    expect([0, 9.5, 1234567.891].map(formatUnitPrice)).toEqual(['$0.00', '$9.50', '$1,234,567.89'])
  })

  it('clamps a long description to two lines, with the whole of it as a tooltip', async () => {
    renderPage()
    await ready()
    const description = within(rowFor('7.13 B')).getByText(LONG_DESCRIPTION)
    expect(description).toHaveClass('line-clamp-2')
    expect(description).toHaveAttribute('title', LONG_DESCRIPTION)
  })

  it('shows a spinner while loading, then the empty state, with Clear all off', async () => {
    let finish
    api.listProjectPayItems.mockReturnValue(new Promise(resolve => { finish = resolve }))
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(clearButton()).toBeDisabled()
    await act(async () => finish([]))
    expect(screen.getByText(EMPTY)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(clearButton()).toBeDisabled()
    expect(addButton()).toBeEnabled()
  })

  it('shows an unknown project as a load error, with a Retry that reads again', async () => {
    api.listProjectPayItems.mockRejectedValueOnce(Object.assign(new Error('Project not found'), { status: 404 }))
    renderPage(ADMIN, 'NOPE')
    expect(await screen.findByText("Couldn't load the pay items: Project not found")).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await ready()
    expect(api.listProjectPayItems).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('heading', { name: 'Pay Items — NOPE' })).toBeInTheDocument() // not in the project list
  })

  it('shows a failed project list as a load error too', async () => {
    api.listAdminProjects.mockRejectedValueOnce(new Error('Failed to fetch projects'))
    renderPage()
    expect(await screen.findByText("Couldn't load the pay items: Failed to fetch projects")).toBeInTheDocument()
  })

  it('goes back to the admin project list', async () => {
    renderPage()
    await ready()
    await userEvent.click(screen.getByRole('button', { name: 'Back to All Projects (Admin)' }))
    expect(screen.getByTestId('url')).toHaveTextContent(/^\/admin\/projects$/)
  })
})

// ---------------------------------------------------------------------------
// Adding and editing
// ---------------------------------------------------------------------------

describe('AdminPayItemsPage — adding a pay item', () => {
  it('opens an empty dialog, saves the item, closes it and reads the list again', async () => {
    renderPage()
    await ready()
    await userEvent.click(addButton())
    expect(screen.getByRole('dialog', { name: 'Add Pay Item' })).toBeInTheDocument()
    await fillIn()
    await userEvent.click(inDialog('Save'))
    expect(api.createProjectPayItem).toHaveBeenCalledTimes(1)
    expect(api.createProjectPayItem).toHaveBeenCalledWith('HWS0023', { pay_item_ref: '10.02',
      budget_code: 'EP0007-CONS', description: 'Asphaltic concrete', unit: 'TN', quantity: 3.2, unit_price: 185 })
    expect(dialog()).not.toBeInTheDocument()
    expect(api.listProjectPayItems).toHaveBeenCalledTimes(2)
    expect(refs()).toEqual(['10.02', '6.02', '4.13 AAS', '7.13 B']) // where the backend sorts it
    expect(cells('10.02').slice(0, 6)).toEqual(['10.02', 'Asphaltic concrete', 'TN', '3.2', '$185.00', 'EP0007-CONS'])
  })

  it('adds the first item of an empty project', async () => {
    server = []
    renderPage()
    await screen.findByText(EMPTY)
    await userEvent.click(addButton())
    await fillIn()
    await userEvent.click(inDialog('Save'))
    expect(refs()).toEqual(['10.02'])
    expect(clearButton()).toBeEnabled()
  })

  it('shows a collision inline, keeps what was typed and reads nothing again', async () => {
    api.createProjectPayItem.mockRejectedValueOnce(Object.assign(
      new Error('A pay item with this ref and budget code already exists for this project'),
      { status: 409, body: { existing_pay_item_uuid: LISTED[0].pay_item_uuid } }))
    renderPage()
    await ready()
    await userEvent.click(addButton())
    await fillIn({ ref: '6.02' })
    await userEvent.click(inDialog('Save'))
    expect(within(dialog()).getByRole('alert'))
      .toHaveTextContent('A pay item with this ref and budget code already exists for this project')
    expect(within(dialog()).getByLabelText('Pay Item Ref')).toHaveValue('6.02')
    expect(within(dialog()).getByLabelText('Unit Price')).toHaveValue(185)
    expect(api.listProjectPayItems).toHaveBeenCalledTimes(1)
  })

  it('shows any other refusal as the backend worded it, and forgets it when the dialog is opened again', async () => {
    api.createProjectPayItem.mockRejectedValueOnce(
      Object.assign(new Error('quantity cannot have more than 10 decimal places'), { status: 400 }))
    renderPage()
    await ready()
    await userEvent.click(addButton())
    await fillIn()
    await userEvent.click(inDialog('Save'))
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('quantity cannot have more than 10 decimal places')
    await userEvent.click(inDialog('Cancel'))
    await userEvent.click(addButton())
    expect(within(dialog()).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(dialog()).getByLabelText('Pay Item Ref')).toHaveValue('')
  })

  it('says so when the save worked but the list could not be read again', async () => {
    renderPage()
    await ready()
    api.listProjectPayItems.mockRejectedValueOnce(new Error('Network error'))
    await userEvent.click(addButton())
    await fillIn()
    await userEvent.click(inDialog('Save'))
    expect(dialog()).not.toBeInTheDocument()
    expect(screen.getByRole('alert'))
      .toHaveTextContent("The change was saved, but the list couldn't be refreshed: Network error")
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await ready()
    expect(refs()).toContain('10.02')
  })

  it('cancels without adding', async () => {
    renderPage()
    await ready()
    await userEvent.click(addButton())
    await fillIn()
    await userEvent.click(inDialog('Cancel'))
    expect(dialog()).not.toBeInTheDocument()
    expect(api.createProjectPayItem).not.toHaveBeenCalled()
  })
})

describe('AdminPayItemsPage — editing a pay item', () => {
  it('opens the dialog with the row\'s values, saves the change and reads the list again', async () => {
    renderPage()
    await ready()
    await userEvent.click(rowButton('4.13 AAS', 'Edit'))
    expect(screen.getByRole('dialog', { name: 'Edit Pay Item' })).toBeInTheDocument()
    expect(within(dialog()).getByLabelText('Pay Item Ref')).toHaveValue('4.13 AAS')
    expect(within(dialog()).getByLabelText('Budget Code')).toHaveValue('HW0001Q-CONS')
    expect(within(dialog()).getByLabelText('Description')).toHaveValue('4" concrete sidewalk')
    expect(within(dialog()).getByLabelText('Unit')).toHaveValue('SF')
    expect(within(dialog()).getByLabelText('Quantity')).toHaveValue(12500)
    expect(within(dialog()).getByLabelText('Unit Price')).toHaveValue(9.5)

    const quantity = within(dialog()).getByLabelText('Quantity')
    await userEvent.clear(quantity)
    await userEvent.type(quantity, '13000')
    await userEvent.click(inDialog('Save'))
    expect(api.updateProjectPayItem).toHaveBeenCalledTimes(1)
    expect(api.updateProjectPayItem).toHaveBeenCalledWith('HWS0023', LISTED[1].pay_item_uuid, {
      pay_item_ref: '4.13 AAS', budget_code: 'HW0001Q-CONS', description: '4" concrete sidewalk', unit: 'SF',
      quantity: 13000, unit_price: 9.5 })
    expect(dialog()).not.toBeInTheDocument()
    expect(api.listProjectPayItems).toHaveBeenCalledTimes(2)
    expect(cells('4.13 AAS')[3]).toBe('13,000')
  })

  it('moves the row to where the backend sorts it after its budget code changes', async () => {
    renderPage()
    await ready()
    await userEvent.click(rowButton('7.13 B', 'Edit'))
    const budgetCode = within(dialog()).getByLabelText('Budget Code')
    await userEvent.clear(budgetCode)
    await userEvent.type(budgetCode, 'AA0001-CONS')
    await userEvent.click(inDialog('Save'))
    expect(refs()).toEqual(['7.13 B', '6.02', '4.13 AAS'])
  })

  it('shows a collision inline and keeps the dialog open', async () => {
    api.updateProjectPayItem.mockRejectedValueOnce(Object.assign(
      new Error('A pay item with this ref and budget code already exists for this project'), { status: 409 }))
    renderPage()
    await ready()
    await userEvent.click(rowButton('7.13 B', 'Edit'))
    await userEvent.click(inDialog('Save'))
    expect(within(dialog()).getByRole('alert'))
      .toHaveTextContent('A pay item with this ref and budget code already exists for this project')
    expect(within(dialog()).getByLabelText('Pay Item Ref')).toHaveValue('7.13 B')
  })
})

// ---------------------------------------------------------------------------
// Deleting one, and clearing all
// ---------------------------------------------------------------------------

describe('AdminPayItemsPage — deleting a pay item', () => {
  it('asks first, naming the item, then deletes it and drops its row without reading the list again', async () => {
    renderPage()
    await ready()
    await userEvent.click(rowButton('6.02', 'Delete'))
    expect(screen.getByRole('dialog', { name: 'Delete pay item?' })).toBeInTheDocument()
    expect(within(dialog()).getByText(
      "This will remove 6.02 (Steel faced curb) from EP0007-CONS. This can't be undone.")).toBeInTheDocument()
    expect(inDialog('Delete')).toHaveClass('btn-danger')
    expect(api.deleteProjectPayItem).not.toHaveBeenCalled()

    await userEvent.click(inDialog('Delete'))
    expect(api.deleteProjectPayItem).toHaveBeenCalledTimes(1)
    expect(api.deleteProjectPayItem).toHaveBeenCalledWith('HWS0023', LISTED[0].pay_item_uuid)
    expect(dialog()).not.toBeInTheDocument()
    expect(refs()).toEqual(['4.13 AAS', '7.13 B'])
    expect(api.listProjectPayItems).toHaveBeenCalledTimes(1)
  })

  it('quotes only the first 60 characters of a long description', async () => {
    renderPage()
    await ready()
    await userEvent.click(rowButton('7.13 B', 'Delete'))
    expect(within(dialog()).getByText(
      `This will remove 7.13 B (${LONG_DESCRIPTION.slice(0, 60)}…) from HW0001Q-CONS. This can't be undone.`))
      .toBeInTheDocument()
  })

  it('shows the empty state after the last item is deleted', async () => {
    server = [LISTED[0]]
    renderPage()
    await ready()
    await userEvent.click(rowButton('6.02', 'Delete'))
    await userEvent.click(inDialog('Delete'))
    expect(screen.getByText(EMPTY)).toBeInTheDocument()
    expect(clearButton()).toBeDisabled()
  })

  it('shows a refusal in the dialog and keeps the row', async () => {
    api.deleteProjectPayItem.mockRejectedValueOnce(Object.assign(new Error('Pay item not found'), { status: 404 }))
    renderPage()
    await ready()
    await userEvent.click(rowButton('6.02', 'Delete'))
    await userEvent.click(inDialog('Delete'))
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('Pay item not found')
    expect(refs()).toContain('6.02')
  })

  it('does nothing when cancelled', async () => {
    renderPage()
    await ready()
    await userEvent.click(rowButton('6.02', 'Delete'))
    await userEvent.click(inDialog('Cancel'))
    expect(dialog()).not.toBeInTheDocument()
    expect(api.deleteProjectPayItem).not.toHaveBeenCalled()
    expect(refs()).toContain('6.02')
  })
})

describe('AdminPayItemsPage — clearing all pay items', () => {
  it('asks first, with the count, then clears, empties the table and announces how many went', async () => {
    renderPage()
    await ready()
    expect(clearButton()).toBeEnabled()
    await userEvent.click(clearButton())
    expect(screen.getByRole('dialog', { name: 'Clear all pay items?' })).toBeInTheDocument()
    expect(within(dialog()).getByText("This will remove all 3 pay items from HWS0023. This can't be undone."))
      .toBeInTheDocument()
    expect(inDialog('Clear all')).toHaveClass('btn-danger')
    expect(api.clearProjectPayItems).not.toHaveBeenCalled()

    await userEvent.click(inDialog('Clear all'))
    expect(api.clearProjectPayItems).toHaveBeenCalledTimes(1)
    expect(api.clearProjectPayItems).toHaveBeenCalledWith('HWS0023')
    expect(dialog()).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText(EMPTY)).toBeInTheDocument()
    expect(banner()).toHaveTextContent('Cleared 3 pay items from HWS0023.')
    expect(api.listProjectPayItems).toHaveBeenCalledTimes(2)
    expect(clearButton()).toBeDisabled()
  })

  it('counts one item as one', async () => {
    server = [LISTED[0]]
    renderPage()
    await ready()
    await userEvent.click(clearButton())
    expect(within(dialog()).getByText("This will remove all 1 pay item from HWS0023. This can't be undone."))
      .toBeInTheDocument()
    await userEvent.click(inDialog('Clear all'))
    expect(banner()).toHaveTextContent('Cleared 1 pay item from HWS0023.')
  })

  it('drops the banner when it is dismissed, or when a dialog is opened', async () => {
    renderPage()
    await ready()
    await userEvent.click(clearButton())
    await userEvent.click(inDialog('Clear all'))
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(banner()).not.toBeInTheDocument()

    await userEvent.click(addButton())
    await fillIn()
    await userEvent.click(inDialog('Save'))
    await userEvent.click(clearButton())
    await userEvent.click(inDialog('Clear all'))
    expect(banner()).toBeInTheDocument()
    await userEvent.click(addButton())
    expect(banner()).not.toBeInTheDocument()
  })

  it('shows a refusal in the dialog and keeps the table', async () => {
    api.clearProjectPayItems.mockRejectedValueOnce(new Error('Failed to clear pay items'))
    renderPage()
    await ready()
    await userEvent.click(clearButton())
    await userEvent.click(inDialog('Clear all'))
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('Failed to clear pay items')
    expect(refs()).toHaveLength(3)
    expect(banner()).not.toBeInTheDocument()
  })

  it('does nothing when cancelled', async () => {
    renderPage()
    await ready()
    await userEvent.click(clearButton())
    await userEvent.click(inDialog('Cancel'))
    expect(dialog()).not.toBeInTheDocument()
    expect(api.clearProjectPayItems).not.toHaveBeenCalled()
    expect(refs()).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// Importing a CSV
// ---------------------------------------------------------------------------

describe('AdminPayItemsPage — importing a CSV', () => {
  const FILE = new File(['pay_item_ref,description\n'], 'items.csv', { type: 'text/csv' })
  const IMPORTED = item(9, '10.02', 'EP0007-CONS', 'Asphaltic concrete', 'TN', 3.2, 185)
  const importButton = () => screen.getByRole('button', { name: 'Import CSV' })

  beforeEach(() => {
    const { pay_item_uuid, ...incoming } = IMPORTED
    api.previewPayItemImport.mockResolvedValue({ parsed_rows: 1, new_count: 1, overwrite_count: 0, error_count: 0,
      ignored_columns: [], new: [{ row: 2, ...incoming }], overwrites: [], errors: [] })
    api.commitPayItemImport.mockImplementation(async () => {
      server = [...server, IMPORTED].sort(byBudgetCodeThenRef)
      return { inserted: 1, updated: 0 }
    })
  })

  async function importFile() {
    await userEvent.click(importButton())
    await userEvent.upload(within(dialog()).getByLabelText('CSV file'), FILE)
    await userEvent.click(inDialog('Preview'))
    await userEvent.click(inDialog('Confirm import'))
  }

  it('has an Import CSV button between Clear all and Add, which opens the dialog', async () => {
    renderPage()
    await ready()
    const names = screen.getAllByRole('button').map(button => button.textContent)
    expect(names.slice(names.indexOf('Clear all pay items'), names.indexOf('Add pay item') + 1))
      .toEqual(['Clear all pay items', 'Import CSV', 'Add pay item'])
    await userEvent.click(importButton())
    expect(screen.getByRole('dialog', { name: 'Import Pay Items' })).toBeInTheDocument()
    expect(within(dialog()).getByLabelText('CSV file')).toBeInTheDocument()
  })

  it('is there for a project with no pay items, whose empty state no longer says it is coming', async () => {
    server = []
    renderPage()
    expect(await screen.findByText(EMPTY)).toBeInTheDocument()
    expect(screen.queryByText(/coming in next release/)).not.toBeInTheDocument()
    expect(importButton()).toBeEnabled()
  })

  it('imports the file, closes the dialog, reads the list again and announces the counts', async () => {
    renderPage()
    await ready()
    await importFile()
    expect(api.previewPayItemImport).toHaveBeenCalledWith('HWS0023', FILE)
    expect(api.commitPayItemImport).toHaveBeenCalledWith('HWS0023', FILE)
    expect(dialog()).not.toBeInTheDocument()
    expect(banner()).toHaveTextContent('Imported 1 new and 0 updated pay items.')
    await waitFor(() => expect(refs()).toEqual(['10.02', '6.02', '4.13 AAS', '7.13 B']))
    expect(api.listProjectPayItems).toHaveBeenCalledTimes(2)
  })

  it('seeds an empty project', async () => {
    server = []
    renderPage()
    await screen.findByText(EMPTY)
    await importFile()
    await waitFor(() => expect(refs()).toEqual(['10.02']))
    expect(clearButton()).toBeEnabled()
  })

  it('drops the banner when a dialog is opened', async () => {
    renderPage()
    await ready()
    await importFile()
    expect(banner()).toBeInTheDocument()
    await userEvent.click(importButton())
    expect(banner()).not.toBeInTheDocument()
  })

  it('changes nothing when the dialog is cancelled', async () => {
    renderPage()
    await ready()
    await userEvent.click(importButton())
    await userEvent.click(inDialog('Cancel'))
    expect(dialog()).not.toBeInTheDocument()
    expect(banner()).not.toBeInTheDocument()
    expect(api.listProjectPayItems).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Admins only
// ---------------------------------------------------------------------------

describe('AdminPayItemsPage — admins only', () => {
  it.each([
    ['an inspector', TEST_USER],
    ['a demo user', DEMO_USER],
  ])('tells %s the page is for admins and reads nothing', async (_, user) => {
    renderPage(user)
    expect(screen.getByText('Only an admin can manage pay items.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add pay item' })).not.toBeInTheDocument()
    expect(api.listProjectPayItems).not.toHaveBeenCalled()
    expect(api.listAdminProjects).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Back to All Projects (Admin)' }))
    expect(screen.getByTestId('url')).toHaveTextContent(/^\/admin\/projects$/)
  })
})

// ---------------------------------------------------------------------------
// Assessment rates
// ---------------------------------------------------------------------------

describe('AdminPayItemsPage — assessment rates', () => {
  const rates = () => screen.getByRole('region', { name: 'Assessment rates' })
  const box4 = () => within(rates()).getByLabelText('4" cost / SF')
  const box7 = () => within(rates()).getByLabelText('7" cost / SF')
  const saveRates = () => within(rates()).getByRole('button', { name: 'Save' })

  beforeEach(() => {
    api.listAdminProjects.mockResolvedValue([
      { ...PROJECTS[0], cost_per_sf_4in: 12.5, cost_per_sf_7in: null },
      PROJECTS[1],
    ])
    api.setAssessmentRates.mockImplementation(async (projectId, body) => ({
      ...PROJECTS[0], cost_per_sf_4in: 12.5, cost_per_sf_7in: null, ...body,
    }))
  })

  it("shows the project's rates from the admin project list, with Save off until one changes", async () => {
    renderPage()
    await ready()
    expect(box4()).toHaveValue(12.5)
    expect(box7()).toHaveValue(null)
    expect(saveRates()).toBeDisabled()
  })

  it('PATCHes only the rate that changed, then says so and keeps the saved values', async () => {
    renderPage()
    await ready()
    await userEvent.type(box7(), '18.75')
    await userEvent.click(saveRates())
    expect(api.setAssessmentRates).toHaveBeenCalledWith('HWS0023', { cost_per_sf_7in: 18.75 })
    expect(await within(rates()).findByText('Assessment rates saved.')).toBeInTheDocument()
    expect(box7()).toHaveValue(18.75)
    expect(saveRates()).toBeDisabled()
  })

  it('clears a rate when its box is emptied', async () => {
    renderPage()
    await ready()
    await userEvent.clear(box4())
    await userEvent.click(saveRates())
    expect(api.setAssessmentRates).toHaveBeenCalledWith('HWS0023', { cost_per_sf_4in: null })
  })

  it('refuses a rate with more than 4 decimal places, sending nothing', async () => {
    renderPage()
    await ready()
    await userEvent.clear(box4())
    await userEvent.type(box4(), '1.23456')
    expect(saveRates()).toBeDisabled()
    expect(within(rates()).getByRole('alert')).toHaveTextContent('at most 4 decimal places')
    expect(api.setAssessmentRates).not.toHaveBeenCalled()
  })

  it("shows the backend's refusal inline and keeps what was typed", async () => {
    api.setAssessmentRates.mockRejectedValueOnce(Object.assign(new Error('A rate is under 1,000,000'), { status: 400 }))
    renderPage()
    await ready()
    await userEvent.type(box7(), '9')
    await userEvent.click(saveRates())
    expect(await within(rates()).findByRole('alert')).toHaveTextContent("Couldn't save the rates: A rate is under 1,000,000")
    expect(box7()).toHaveValue(9)
    expect(saveRates()).toBeEnabled()
  })
})
