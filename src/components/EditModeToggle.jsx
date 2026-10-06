import { Pencil } from 'lucide-react'

/**
 * The reviewer's edit-mode switch for an IDR: off by default; on, every field they may edit shows a pencil.
 * Rendered only for the reviewer who accepted the IDR at its current stage (or an admin).
 * Props: on (boolean), onToggle().
 */
export default function EditModeToggle({ on, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={`inline-flex items-center space-x-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${on
        ? 'border-construction-600 bg-construction-50 text-construction-800'
        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
    >
      <Pencil className="h-4 w-4" />
      <span>{on ? 'Edit mode: on' : 'Edit mode: off'}</span>
    </button>
  )
}
