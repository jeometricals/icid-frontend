import { ChevronsRight } from 'lucide-react'

/**
 * A thin horizontal progress bar: a grey track filled to a percentage. Past 100 the track is full and a small
 * arrow after it says there is more; with no percentage (null) the track is empty.
 * Props: percent (null, or a number of 0 or more), tone ('default', or 'warn' for over budget), label (what it
 * measures, for a screen reader).
 */
export default function Bar({ percent = null, tone = 'default', label = 'Progress' }) {
  const known = typeof percent === 'number' && Number.isFinite(percent)
  const width = known ? Math.min(Math.max(percent, 0), 100) : 0
  const warn = tone === 'warn'

  return (
    <div className="flex items-center gap-1">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={known ? width : undefined}
        aria-valuetext={known ? `${percent}%` : undefined}
        className="h-2 flex-1 min-w-[4rem] rounded-full bg-gray-200 overflow-hidden"
      >
        {known && (
          <div
            data-testid="bar-fill"
            className={`h-full rounded-full ${warn ? 'bg-warn' : 'bg-construction-600'}`}
            style={{ width: `${width}%` }}
          />
        )}
      </div>
      {known && percent > 100 && (
        <ChevronsRight
          data-testid="bar-overflow"
          aria-hidden="true"
          className={`h-3 w-3 shrink-0 ${warn ? 'text-warn' : 'text-construction-600'}`}
        />
      )}
    </div>
  )
}
