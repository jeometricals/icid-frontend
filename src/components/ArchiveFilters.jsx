import { useEffect, useRef, useState } from 'react'
import { DISCIPLINES } from '../data/disciplines'

// The filters with nothing set
export const NO_FILTERS = { idrNumber: '', workDate: '', from: '', to: '', disciplines: [] }

// How long the IDR # box waits after the last keystroke before it filters
export const IDR_NUMBER_DEBOUNCE_MS = 300

/**
 * The Report Archive's filter panel: an IDR # search box, a work date or a from / to range (setting one clears the
 * other), a checkbox per discipline, and Clear filters. It holds no filters of its own, only the text being typed.
 * Props: filters ({idrNumber, workDate, from, to, disciplines}; dates as YYYY-MM-DD, '' when not set),
 * onChange(patch, {replace}) (the filters that changed; replace is true for typing, which shouldn't pile up
 * history entries).
 */
export default function ArchiveFilters({ filters, onChange }) {
  const [text, setText] = useState(filters.idrNumber)
  // The timer below outlives the render that started it, so it calls whatever onChange is current by then
  const latestOnChange = useRef(onChange)
  latestOnChange.current = onChange

  // The filter changed from outside (Clear, Back, a pasted link): show it, unless it is what's already typed
  useEffect(() => {
    setText(current => (current.trim() === filters.idrNumber ? current : filters.idrNumber))
  }, [filters.idrNumber])

  useEffect(() => {
    const idrNumber = text.trim()
    if (idrNumber === filters.idrNumber) return
    const timer = setTimeout(() => latestOnChange.current({ idrNumber }, { replace: true }), IDR_NUMBER_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, filters.idrNumber])

  const change = (patch) => onChange(patch, { replace: false })

  const toggleDiscipline = (discipline) => {
    const chosen = filters.disciplines.includes(discipline)
      ? filters.disciplines.filter(d => d !== discipline)
      : [...filters.disciplines, discipline]
    change({ disciplines: DISCIPLINES.filter(d => chosen.includes(d)) })
  }

  const clear = () => {
    setText('')
    change(NO_FILTERS)
  }

  const anySet = Boolean(text || filters.idrNumber || filters.workDate || filters.from || filters.to
    || filters.disciplines.length)

  return (
    <section aria-label="Filters" className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="archive-idr-number" className="input-label">IDR #</label>
          <input
            id="archive-idr-number"
            type="search"
            className="input-field"
            placeholder="Starts with..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="archive-work-date" className="input-label">Work date</label>
          <input
            id="archive-work-date"
            type="date"
            className="input-field"
            value={filters.workDate}
            onChange={(e) => change({ workDate: e.target.value, from: '', to: '' })}
          />
        </div>
        <div>
          <label htmlFor="archive-from" className="input-label">From</label>
          <input
            id="archive-from"
            type="date"
            className="input-field"
            max={filters.to || undefined}
            value={filters.from}
            onChange={(e) => change({ from: e.target.value, workDate: '' })}
          />
        </div>
        <div>
          <label htmlFor="archive-to" className="input-label">To</label>
          <input
            id="archive-to"
            type="date"
            className="input-field"
            min={filters.from || undefined}
            value={filters.to}
            onChange={(e) => change({ to: e.target.value, workDate: '' })}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <fieldset>
          <legend className="input-label">Discipline</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {DISCIPLINES.map(discipline => (
              <label key={discipline} className="inline-flex items-center space-x-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-construction-600 focus:ring-construction-500"
                  checked={filters.disciplines.includes(discipline)}
                  onChange={() => toggleDiscipline(discipline)}
                />
                <span>{discipline}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="button" onClick={clear} disabled={!anySet} className="btn-secondary">
          Clear filters
        </button>
      </div>
    </section>
  )
}
