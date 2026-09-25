import { Info } from 'lucide-react'
import { format, parseISO } from 'date-fns'

/**
 * Compact read-only line with the parent IDR's shared data (date, weather, temps, work hours) for a report page.
 * These fields live on the IDR, so the line points there for edits.
 * Props: idr (the IDR's report_date, weather_am/pm, temp_low/high, work_start_time/work_end_time).
 */
export default function IdrContextLine({ idr }) {
  const parts = [
    // parseISO keeps a date-only string in local time (new Date() would shift it a day in US zones)
    ['Date', format(parseISO(idr.report_date), 'MMM d, yyyy')],
    ['Weather', pair(idr.weather_am, idr.weather_pm)],
    ['Temp', pair(temp(idr.temp_low), temp(idr.temp_high), ' °F')],
    ['Work', pair(time(idr.work_start_time), time(idr.work_end_time), '', ' - ')],
  ]
  return (
    <div className="bg-white rounded-lg shadow-sm px-6 py-3 mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700">
      <Info className="h-4 w-4 text-construction-700" />
      <span>
        {parts.map(([label, value], i) => (
          <span key={label}>
            {i > 0 && <span className="text-gray-400">{' · '}</span>}
            <span className="font-medium text-construction-700">{label}:</span> {value}
          </span>
        ))}
      </span>
      <span className="text-gray-500 sm:ml-auto">Set on the IDR page</span>
    </div>
  )
}

// "Clear / Cloudy", "Clear / —", or just "—" when both halves are missing
function pair(first, second, suffix = '', separator = ' / ') {
  if (first == null && second == null) return '—'
  return `${first ?? '—'}${separator}${second ?? '—'}${suffix}`
}

// 42.0 → "42", 42.5 → "42.5"
function temp(value) {
  return value == null ? null : String(Number(value))
}

// '07:30:00' → '07:30'
function time(value) {
  return value == null ? null : String(value).slice(0, 5)
}
