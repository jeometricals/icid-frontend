import { Lock } from 'lucide-react'
import { format } from 'date-fns'

/**
 * Lock notice shown in place of the save/submit controls once a report or IDR is submitted.
 * Props: submittedAt (ISO string, or null for a record submitted before submit times were recorded),
 * label (text before the time; default "Submitted").
 */
export default function SubmittedBanner({ submittedAt, label = 'Submitted' }) {
  const when = submittedAt ? ` at ${format(new Date(submittedAt), "HH:mm 'on' MMMM d, yyyy")}` : ''
  return (
    <div className="flex items-center space-x-2 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 py-2 text-sm font-medium">
      <Lock className="h-4 w-4" />
      <span>{label}{when}</span>
    </div>
  )
}
