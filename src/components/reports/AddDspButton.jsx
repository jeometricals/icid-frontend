/**
 * "Add DSP": adds the IDR's one Daily Site Patrol as the addendum of parentReportId, then opens it. Disabled, with
 * the tooltip "DSP already added to this IDR.", once the IDR has one; the backend's refusal (400 / 409) shows as worded.
 * Props: projectId, idrId, parentReportId, reports (every report in the IDR), navigateSafely(action) (saves the page's
 * unsaved edits first; a failed save neither creates nor navigates).
 */
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { addReport } from '../../services/api'
import { DSP_TAKEN_TOOLTIP, findDsp, reportPagePath } from '../../data/reportTypes'
import { listOrigin } from '../../lib/listOrigin'

const navigateNow = (action) => action()

export default function AddDspButton({ projectId, idrId, parentReportId, reports, navigateSafely = navigateNow }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  const taken = Boolean(findDsp(reports))

  const handleAdd = async () => {
    if (adding || taken) return
    setAdding(true)
    setError(null)
    try {
      await navigateSafely(async () => {
        const created = await addReport(idrId, { reportType: 'DSP', isAddendum: true, parentReportId })
        // Keep the list the IDR was opened from, so Back to IDR from the DSP still returns there
        navigate(reportPagePath(projectId, idrId, created), { state: listOrigin(location) })
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {/* The title sits on the wrapper too: a disabled button gets no hover in some browsers */}
      <span title={taken ? DSP_TAKEN_TOOLTIP : undefined}>
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || taken}
          title={taken ? DSP_TAKEN_TOOLTIP : undefined}
          className="btn-secondary flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          <span>{adding ? 'Adding...' : 'Add DSP'}</span>
        </button>
      </span>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
