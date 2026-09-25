import { Send } from 'lucide-react'

/**
 * "Submit Report" button for report forms. Disabled and labelled "Submitting..." while a submit is in flight.
 * Props: onClick (submit handler), submitting (boolean), disabled (boolean, e.g. report never saved),
 * label (button text; default "Submit Report").
 */
export default function SubmitReportButton({ onClick, submitting, disabled = false, label = 'Submit Report' }) {
  return (
    <button
      onClick={onClick}
      disabled={submitting || disabled}
      className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Send className="h-4 w-4" />
      <span>{submitting ? 'Submitting...' : label}</span>
    </button>
  )
}
