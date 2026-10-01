/**
 * The pay-item picker: a dropdown with a search box, one entry per catalog item no. (its budget codes gathered
 * together), and a "+ Add manually" button. Rendered into document.body at a fixed position under the anchor cell, so
 * a scrolling table can't clip it. Arrow keys move the highlight, Enter picks, Escape or a click outside closes.
 * Props: items (contract items as getContractItems returns them), onPick(entry), onAddManual(), onClose(),
 * getAnchor() (the element to sit under; optional), autoFocus (focus the search box on open).
 * An entry is { itemNo, description, payUnit, budgetCodes }.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export const EMPTY_CATALOG_MESSAGE = "No items in this project's catalog. Click '+ Add manually' to enter one."
export const NO_MATCHES_MESSAGE = 'No matching items.'

/**
 * Contract items grouped into one entry per item no., in catalog order, each with every budget code it appears under.
 */
export function catalogEntries(items) {
  const byItemNo = new Map()
  for (const item of items) {
    const entry = byItemNo.get(item.item_no)
    if (entry) {
      if (!entry.budgetCodes.includes(item.budget_code)) entry.budgetCodes.push(item.budget_code)
    } else {
      byItemNo.set(item.item_no, {
        itemNo: item.item_no,
        description: item.description,
        payUnit: item.pay_unit,
        budgetCodes: [item.budget_code],
      })
    }
  }
  return [...byItemNo.values()]
}

// Case-insensitive substring match on the item no. or the description
function matches(entry, query) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return entry.itemNo.toLowerCase().includes(needle) || entry.description.toLowerCase().includes(needle)
}

// Where the dropdown sits: just under the anchor, at least 20rem wide
function positionUnder(anchor) {
  if (!anchor) return {}
  const rect = anchor.getBoundingClientRect()
  return { top: rect.bottom, left: rect.left, minWidth: Math.max(rect.width, 320) }
}

export default function PayItemPicker({ items, onPick, onAddManual, onClose, getAnchor, autoFocus = false }) {
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(-1)
  const [position, setPosition] = useState({})
  const dropdownRef = useRef(null)
  const listId = useId()

  const entries = useMemo(() => catalogEntries(items), [items])
  const visible = entries.filter(entry => matches(entry, query))

  // Follow the anchor as the page or the table scrolls
  useLayoutEffect(() => {
    const place = () => setPosition(positionUnder(getAnchor?.()))
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [getAnchor])

  // A press outside both the dropdown and its anchor closes it
  useEffect(() => {
    const handlePointerDown = (e) => {
      if (dropdownRef.current?.contains(e.target)) return
      if (getAnchor?.()?.contains(e.target)) return
      onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [getAnchor, onClose])

  // Keep the highlighted entry in view
  useEffect(() => {
    if (highlight < 0) return
    document.getElementById(`${listId}-${highlight}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [highlight, listId])

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(h + 1, visible.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlight >= 0 && highlight < visible.length) onPick(visible[highlight])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  let emptyMessage = null
  if (entries.length === 0) emptyMessage = EMPTY_CATALOG_MESSAGE
  else if (visible.length === 0) emptyMessage = NO_MATCHES_MESSAGE

  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-md shadow-lg"
      style={position}
      data-testid="pay-item-picker"
    >
      <div className="p-2 border-b border-gray-100">
        <input
          type="text"
          className="input-field"
          placeholder="Search by item no. or description…"
          aria-label="Search pay items"
          aria-controls={listId}
          aria-activedescendant={highlight >= 0 ? `${listId}-${highlight}` : undefined}
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setHighlight(-1)
          }}
          onKeyDown={handleKeyDown}
        />
      </div>
      {emptyMessage ? (
        <p className="px-3 py-3 text-sm text-gray-500">{emptyMessage}</p>
      ) : (
        <ul id={listId} role="listbox" aria-label="Pay items" className="max-h-64 overflow-y-auto py-1">
          {visible.map((entry, index) => (
            <li
              key={entry.itemNo}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === highlight}
              className={`px-3 py-2 text-sm cursor-pointer ${index === highlight ? 'bg-construction-100' : 'hover:bg-gray-50'}`}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => onPick(entry)}
            >
              {entry.itemNo} — {entry.description} ({entry.payUnit})
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-gray-100 p-2">
        <button type="button" className="text-sm text-construction-700 hover:underline" onClick={onAddManual}>
          + Add manually
        </button>
      </div>
    </div>,
    document.body
  )
}
