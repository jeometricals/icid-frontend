import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { readReturnTo } from '../lib/returnTo'

/**
 * "Back to report": shown on a site page or its PIR sketch workspace when the URL carries a `?returnTo=` to follow
 * (an IDR report page; see lib/returnTo.js), and goes there. Renders nothing otherwise. No props.
 */
export default function BackToReportButton() {
  const navigate = useNavigate()
  const returnTo = readReturnTo(useLocation().search)
  if (!returnTo) return null
  return (
    <button
      onClick={() => navigate(returnTo)}
      className="flex items-center space-x-2 text-construction-700 hover:text-construction-800"
    >
      <ArrowLeft className="h-5 w-5" />
      <span className="font-medium">Back to report</span>
    </button>
  )
}
