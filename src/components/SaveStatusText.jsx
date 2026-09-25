import { format } from 'date-fns'

/**
 * One-line save status shown next to a save button: error, last saved time, or unsaved changes.
 * Props: status, savedAt (ISO string or null), error (message or null), hasUnsavedChanges,
 * actionLabel (the save button's text, used in the retry hint; default "Save Draft").
 */
export default function SaveStatusText({ status, savedAt, error, hasUnsavedChanges, actionLabel = 'Save Draft' }) {
  if (status === 'error') {
    return <span className="text-sm text-red-600">Save failed: {error}. Click {actionLabel} to retry.</span>
  }
  if (status === 'saving') return null
  const savedText = savedAt ? `Saved at ${format(new Date(savedAt), 'HH:mm')}` : null
  if (hasUnsavedChanges) {
    return (
      <span className="text-sm text-gray-500">
        Unsaved changes{savedText ? ` (last ${savedText.toLowerCase()})` : ''}
      </span>
    )
  }
  return savedText ? <span className="text-sm text-green-700">{savedText}</span> : null
}
