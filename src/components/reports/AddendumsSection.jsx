/**
 * The "Addendums" card on a main report: lists the addendums attached to this report (Open / Delete) and adds new
 * ones of any addendum type that has a form page, then opens the new addendum. Takes the IDR's reports from the page
 * instead of fetching them. Props: projectId, idrId, reportId, reports (every report in the IDR), onChanged (refetch the IDR
 * after a delete), disabled (IDR submitted or report auto-generated: hides Add and Delete).
 */
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FileText, Plus, Trash2 } from 'lucide-react'
import { addReport, deleteReport } from '../../services/api'
import { REPORT_TYPES, isAddendumType, isReportTypeAvailable, reportTypeLabel, reportTypeRoute } from '../../data/reportTypes'
import ConfirmDialog from '../ConfirmDialog'

// Addendum types with a form page, in catalog order
const ADDABLE_TYPES = REPORT_TYPES.filter(({ code }) => isAddendumType(code) && isReportTypeAvailable(code))

export default function AddendumsSection({ projectId, idrId, reportId, reports, onChanged, disabled = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null) // the addendum whose delete is being confirmed
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const addendums = reports.filter(r => r.parent_report_id === reportId)

  // Keep the list the IDR was opened from, so Back to IDR from the addendum still returns there
  const openAddendum = (addendum) => {
    const segment = reportTypeRoute(addendum.report_type)
    navigate(`/project/${projectId}/idr/${idrId}/${segment}/${addendum.report_id}`, {
      state: { from: location.state?.from },
    })
  }

  const handleAdd = async (reportType) => {
    if (adding) return
    setAdding(true)
    setAddError(null)
    try {
      const created = await addReport(idrId, { reportType, isAddendum: true, parentReportId: reportId })
      setPickerOpen(false)
      openAddendum(created)
    } catch (err) {
      setAddError(`Couldn't add addendum: ${err.message}`)
    } finally {
      setAdding(false)
    }
  }

  const confirmDelete = async () => {
    if (deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteReport(idrId, pendingDelete.report_id)
      setPendingDelete(null)
      await onChanged()
    } catch (err) {
      setDeleteError(`Couldn't delete addendum: ${err.message}`)
    } finally {
      setDeleting(false)
    }
  }

  const cancelDelete = () => {
    setPendingDelete(null)
    setDeleteError(null)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="form-section-title mb-0">Addendums</h3>
        {!disabled && ADDABLE_TYPES.length > 0 && (
          <button
            type="button"
            onClick={() => setPickerOpen(open => !open)}
            disabled={adding}
            aria-expanded={pickerOpen}
            className="btn-primary flex items-center space-x-1"
          >
            <Plus className="h-4 w-4" />
            <span>{adding ? 'Adding...' : 'Add addendum'}</span>
          </button>
        )}
      </div>

      {pickerOpen && !disabled && (
        <div role="group" aria-label="Addendum types" className="flex flex-wrap gap-2 mb-4">
          {ADDABLE_TYPES.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              onClick={() => handleAdd(code)}
              disabled={adding}
              className="btn-secondary text-sm"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {addError && <p role="alert" className="text-sm text-red-600 mb-4">{addError}</p>}

      {addendums.length === 0 ? (
        <p className="text-gray-500">No addendums yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {addendums.map(addendum => {
            const label = reportTypeLabel(addendum.report_type)
            const canOpen = Boolean(reportTypeRoute(addendum.report_type))
            return (
              <li key={addendum.report_id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="bg-construction-100 p-2 rounded-lg">
                    <FileText className="h-5 w-5 text-construction-700" />
                  </div>
                  <span className="font-medium text-gray-900 truncate">{label}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => openAddendum(addendum)}
                    disabled={!canOpen}
                    title={canOpen ? undefined : 'Form not available yet'}
                    aria-label={`Open ${label}`}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Open
                  </button>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => setPendingDelete(addendum)}
                      aria-label={`Delete ${label}`}
                      className="btn-secondary flex items-center space-x-1"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete addendum"
          message={`Delete this ${reportTypeLabel(pendingDelete.report_type)} addendum? This cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          busy={deleting}
          error={deleteError}
        />
      )}
    </div>
  )
}
