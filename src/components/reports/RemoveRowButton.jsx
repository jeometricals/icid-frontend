/**
 * A small × icon button that removes a row from a report section (added trades, added equipment).
 * Props: onClick, ariaLabel (required, e.g. "Remove Masons"), disabled (default false).
 */
import { X } from 'lucide-react'

export default function RemoveRowButton({ onClick, ariaLabel, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="text-gray-400 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <X className="h-5 w-5" />
    </button>
  )
}
