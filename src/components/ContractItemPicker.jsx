import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

// "4.13 AAS — 4" Concrete Sidewalk (Unpigmented)", what a picked contract item reads as
export const contractItemLabel = (item) => `${item.item_no} — ${item.description}`

// Whether a contract item matches the search: its item no. or description holds the text, any case
const matches = (item, text) => {
  const needle = text.trim().toLowerCase()
  return !needle || item.item_no.toLowerCase().includes(needle) || item.description.toLowerCase().includes(needle)
}

/**
 * Picks one of the project's contract items, or none: the field shows the pick ("item no — description") with
 * Change and Clear, or "No pay item" with Choose. Choose opens a panel under the field with a search box (item no.
 * or description, any case) and one button per contract item, its budget code beside it (the same item no. can
 * sit under two budget codes, and each is its own contract item). Picking one closes the panel.
 * Props: id (for the label), items (contract items as getContractItems returns them), value (the picked
 * contract_item_id, or null), onChange(contract_item_id or null), disabled.
 */
export default function ContractItemPicker({ id, items, value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const picked = items.find(item => item.contract_item_id === value) ?? null
  const shown = useMemo(() => items.filter(item => matches(item, search)), [items, search])

  const pick = (contractItemId) => {
    onChange(contractItemId)
    setOpen(false)
    setSearch('')
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span id={id} className={`flex-1 text-sm ${picked ? 'text-gray-900' : 'text-gray-500'}`}>
          {picked ? contractItemLabel(picked) : value ? 'A pay item not in this project\'s catalog' : 'No pay item'}
        </span>
        <button
          type="button"
          onClick={() => setOpen(current => !current)}
          disabled={disabled}
          aria-expanded={open}
          className="text-sm font-medium text-construction-700 hover:text-construction-800 underline disabled:text-gray-400"
        >
          {value ? 'Change' : 'Choose'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => pick(null)}
            disabled={disabled}
            className="text-sm font-medium text-construction-700 hover:text-construction-800 underline disabled:text-gray-400"
          >
            Clear
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 border border-gray-200 rounded-md p-2 space-y-2">
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="search"
              aria-label="Search pay items"
              placeholder="Search by item no. or description"
              className="input-field pl-9"
              value={search}
              autoFocus
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-gray-600 px-1">This project has no pay items in its catalog.</p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-gray-600 px-1">No pay items match "{search.trim()}".</p>
          ) : (
            <ul role="listbox" aria-label="Pay items" className="max-h-56 overflow-y-auto divide-y divide-gray-100">
              {shown.map(item => (
                <li key={item.contract_item_id} role="option" aria-selected={item.contract_item_id === value}>
                  <button
                    type="button"
                    onClick={() => pick(item.contract_item_id)}
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-50 flex gap-3"
                  >
                    <span className="flex-1">{contractItemLabel(item)}</span>
                    <span className="text-gray-500 whitespace-nowrap">{item.budget_code}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
