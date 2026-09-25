/**
 * One IDR (Inspector Daily Report) at /project/:projectId/idr/:idrId: the shared header form, the reports
 * inside the IDR (add, open, delete) and Submit. Every change is followed by a silent refetch, so the page
 * always shows what the server has. A submitted IDR renders read-only with a "Submitted at" banner.
 */
import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { getIdr, saveIdrHeader, addReport, deleteReport, submitIdr } from '../services/api'
import { headerFormValues, changedHeaderFields } from '../lib/idrHeader'
import { reportTypeLabel } from '../data/reportTypes'
import IdrHeaderForm from '../components/IdrHeaderForm'
import IdrReportRow from '../components/IdrReportRow'
import AddReportControl from '../components/AddReportControl'
import SaveDraftButton from '../components/SaveDraftButton'
import SubmitReportButton from '../components/SubmitReportButton'
import SaveStatusText from '../components/SaveStatusText'
import SubmittedBanner from '../components/SubmittedBanner'

const SUBMIT_CONFIRM = "Submit this IDR? Once submitted, it can't be edited."
const SAVE_HEADER_BEFORE_SUBMIT = 'Please save the header before submitting.'

// Where "Back" goes, keyed by the list page that opened the IDR (router state.from)
const BACK_TARGETS = {
  drafts: { path: '/drafts', label: 'Back to Drafts' },
  archive: { path: '/archive', label: 'Back to Archive' },
}
const BACK_TO_PROJECT = { path: '', label: 'Back to Project Dashboard' }

// The backend deletes a main report's addendums with it, so the confirm says so
function deleteConfirmMessage(report, reports) {
  const addendums = reports.filter(r => r.parent_report_id === report.report_id).length
  const alsoDeleted = addendums ? ` Its ${addendums} addendum${addendums === 1 ? '' : 's'} will be deleted too.` : ''
  return `Delete this ${reportTypeLabel(report.report_type)} report? This cannot be undone.${alsoDeleted}`
}

export default function IDRPage() {
  const { projectId, idrId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const back = BACK_TARGETS[location.state?.from] || BACK_TO_PROJECT

  // Initial load; only this shows a spinner
  const [loadStatus, setLoadStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [loadError, setLoadError] = useState(null)
  const [loadAttempt, setLoadAttempt] = useState(0) // bump to retry

  // Server state. savedHeader is the last header the server confirmed; headerForm is what's typed.
  const [idr, setIdr] = useState(null) // header fields + status, without reports
  const [reports, setReports] = useState([])
  const [savedHeader, setSavedHeader] = useState(null)
  const [headerForm, setHeaderForm] = useState(null)

  // One action at a time: 'header' | 'add' | 'submit' | the report_id being deleted
  const [busyAction, setBusyAction] = useState(null)
  const [headerSave, setHeaderSave] = useState({ status: 'idle', savedAt: null, error: null })
  const [actionError, setActionError] = useState(null) // { scope: 'reports' | 'submit', message }
  const [refreshError, setRefreshError] = useState(null)

  // Puts a getIdr response into state. resetForm replaces the typed header (initial load only).
  const applyIdr = useCallback((data, { resetForm }) => {
    const { reports: reportRows, ...idrFields } = data
    const serverHeader = headerFormValues(idrFields)
    setIdr(idrFields)
    setReports(reportRows)
    setSavedHeader(serverHeader)
    if (resetForm) setHeaderForm(serverHeader)
  }, [])

  useEffect(() => {
    let ignore = false
    setLoadStatus('loading')
    setLoadError(null)
    getIdr(idrId)
      .then(data => {
        if (ignore) return
        // An IDR from another project under this URL is treated as missing
        if (data.project_id !== projectId) throw new Error('IDR not found in this project')
        applyIdr(data, { resetForm: true })
        setLoadStatus('ready')
      })
      .catch(err => {
        if (ignore) return
        setLoadError(err.message)
        setLoadStatus('error')
      })
    return () => { ignore = true }
  }, [projectId, idrId, loadAttempt, applyIdr])

  // Silent refetch after a change: the old UI stays up until it lands; a failure gets its own message
  const refresh = async () => {
    try {
      applyIdr(await getIdr(idrId), { resetForm: false })
      setRefreshError(null)
    } catch (err) {
      setRefreshError(err.message)
    }
  }

  // Runs one change, reports its error through onError, then refetches whether it worked or not
  // (a failed change can still mean the server moved on, e.g. the IDR was submitted elsewhere).
  const runAction = async (name, change, onError) => {
    setBusyAction(name)
    setActionError(null)
    try {
      await change()
    } catch (err) {
      onError(err.message)
    }
    await refresh()
    setBusyAction(null)
  }

  if (loadStatus === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
        <p className="mt-4 text-gray-600">Loading IDR...</p>
      </div>
    )
  }

  if (loadStatus === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-lg shadow-sm p-6 text-center max-w-md">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Couldn't open this IDR</h2>
          <p className="text-red-600 mb-6">{loadError}</p>
          <div className="flex justify-center space-x-3">
            <button onClick={() => setLoadAttempt(a => a + 1)} className="btn-primary">
              Retry
            </button>
            <button onClick={() => navigate(`/project/${projectId}${back.path}`)} className="btn-secondary">
              {back.label}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const readOnly = idr.status !== 'draft'
  const busy = busyAction !== null
  const headerChanges = changedHeaderFields(headerForm, savedHeader)
  const headerDirty = Object.keys(headerChanges).length > 0
  const generalExists = reports.some(r => r.report_type === 'GEN' && !r.is_addendum)

  const handleHeaderChange = (field, value) => {
    setHeaderForm(prev => ({ ...prev, [field]: value }))
  }

  // Sends only the changed fields; the button is disabled when there are none
  const handleSaveHeader = () => {
    if (busy || !headerDirty) return
    setHeaderSave(prev => ({ ...prev, status: 'saving' }))
    runAction('header', async () => {
      const saved = await saveIdrHeader(idrId, headerChanges)
      setSavedHeader(headerFormValues(saved))
      setHeaderSave({ status: 'saved', savedAt: saved.updated_at, error: null })
    }, message => setHeaderSave(prev => ({ ...prev, status: 'error', error: message })))
  }

  const handleAddReport = (reportType) => {
    if (busy) return
    runAction('add', () => addReport(idrId, { reportType }),
      message => setActionError({ scope: 'reports', message: `Couldn't add report: ${message}` }))
  }

  const handleDeleteReport = (report) => {
    if (busy) return
    if (!window.confirm(deleteConfirmMessage(report, reports))) return
    runAction(report.report_id, () => deleteReport(idrId, report.report_id),
      message => setActionError({ scope: 'reports', message: `Couldn't delete report: ${message}` }))
  }

  // Blocks on unsaved header edits so what gets submitted is what's on screen
  const handleSubmit = () => {
    if (busy || reports.length === 0) return
    if (headerDirty) {
      window.alert(SAVE_HEADER_BEFORE_SUBMIT)
      return
    }
    if (!window.confirm(SUBMIT_CONFIRM)) return
    runAction('submit', () => submitIdr(idrId),
      message => setActionError({ scope: 'submit', message: `Submit failed: ${message}` }))
  }

  const openReport = (report) => {
    navigate(`/project/${projectId}/idr/${idrId}/report/${report.report_id}`, { state: { from: location.state?.from } })
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(`/project/${projectId}${back.path}`)}
              className="flex items-center space-x-2 text-construction-700 hover:text-construction-800"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-medium">{back.label}</span>
            </button>
            {readOnly && <SubmittedBanner submittedAt={idr.submitted_at} />}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Inspector Daily Report</h1>
          <p className="text-gray-600 mt-1">
            {/* parseISO keeps a date-only string in local time (new Date() would shift it a day in US zones) */}
            {format(parseISO(idr.report_date), 'EEEE, MMMM d, yyyy')} · Project {projectId}
          </p>
        </div>

        {refreshError && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 flex items-center justify-between">
            <span>Couldn't refresh this IDR: {refreshError}</span>
            <button onClick={refresh} disabled={busy} className="btn-secondary disabled:opacity-50">
              Retry
            </button>
          </div>
        )}

        {/* Shared header */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="form-section-title">Time & Weather</h2>
          <fieldset disabled={readOnly} className="min-w-0 border-0 p-0 m-0">
            <IdrHeaderForm values={readOnly ? savedHeader : headerForm} onChange={handleHeaderChange} />
          </fieldset>
          {!readOnly && (
            <div className="flex items-center justify-end space-x-3 mt-4">
              <SaveStatusText
                status={headerSave.status}
                savedAt={headerSave.savedAt}
                error={headerSave.error}
                hasUnsavedChanges={headerDirty}
                actionLabel="Save Header"
              />
              <SaveDraftButton
                label="Save Header"
                onClick={handleSaveHeader}
                saving={busyAction === 'header'}
                disabled={!headerDirty || busy}
              />
            </div>
          )}
        </section>

        {/* Reports */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="form-section-title">Reports</h2>
          {reports.length === 0 ? (
            <p className="text-gray-500 py-4">{readOnly ? 'This IDR has no reports.' : 'No reports yet. Add one below.'}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {reports.map(report => (
                <IdrReportRow
                  key={report.report_id}
                  report={report}
                  totalPages={idr.total_pages}
                  readOnly={readOnly}
                  disabled={busy}
                  deleting={busyAction === report.report_id}
                  onOpen={() => openReport(report)}
                  onDelete={() => handleDeleteReport(report)}
                />
              ))}
            </ul>
          )}
          {actionError?.scope === 'reports' && (
            <p role="alert" className="text-sm text-red-600 mt-3">{actionError.message}</p>
          )}
          {!readOnly && (
            <div className="border-t border-gray-100 pt-4 mt-2">
              <AddReportControl
                onAdd={handleAddReport}
                adding={busyAction === 'add'}
                disabled={busy}
                generalExists={generalExists}
              />
            </div>
          )}
        </section>

        {/* Submit */}
        {!readOnly && (
          <div className="flex flex-col items-end space-y-2">
            <SubmitReportButton
              label="Submit IDR"
              onClick={handleSubmit}
              submitting={busyAction === 'submit'}
              disabled={reports.length === 0 || busy}
            />
            {reports.length === 0 && (
              <p className="text-sm text-gray-500">Add at least one report before submitting.</p>
            )}
            {actionError?.scope === 'submit' && (
              <p role="alert" className="text-sm text-red-600">{actionError.message}</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
