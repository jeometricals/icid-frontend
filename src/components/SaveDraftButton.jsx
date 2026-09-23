import { Save } from 'lucide-react'

/**
 * "Save Draft" button for report forms. Disabled and labelled "Saving..." while a save is in flight.
 * Props: onClick (save handler), saving (boolean).
 */
export default function SaveDraftButton({ onClick, saving }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="btn-secondary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Save className="h-4 w-4" />
      <span>{saving ? 'Saving...' : 'Save Draft'}</span>
    </button>
  )
}
