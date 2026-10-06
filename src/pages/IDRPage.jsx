/**
 * One IDR (Inspector Daily Report) at /project/:projectId/idr/:idrId: the shared header form, the reports
 * inside the IDR (add, open, delete), Export (.xlsx) and Submit. Every change is followed by a silent refetch, so
 * the page always shows what the server has. A submitted IDR renders read-only under a banner saying who submitted
 * it and when, and keeps its Export button. The title carries the IDR's status and number. From submission on, a
 * reviewer gets the review toolbar (accept, approve, return); an IDR carrying a return comment shows it. Reviewer
 * edits of the header read as redlines; the reviewer who holds the IDR gets an edit-mode switch, which carries over to
 * its report pages.
 */
import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { useProjectRoles } from '../contexts/ProjectRolesContext'
import { useTaskCount } from '../contexts/TaskCountContext'
import { getIdr, saveIdrHeader, addReport, deleteReport, submitIdr, listUsers } from '../services/api'
import { headerFormValues, changedHeaderFields } from '../lib/idrHeader'
import { personName } from '../lib/personName'
import { reportTypeLabel, reportTypeRoute } from '../data/reportTypes'
import IdrHeaderForm from '../components/IdrHeaderForm'
import IdrReportRow from '../components/IdrReportRow'
import AddReportControl from '../components/AddReportControl'
import SaveDraftButton from '../components/SaveDraftButton'
import SubmitReportButton from '../components/SubmitReportButton'
import SaveStatusText from '../components/SaveStatusText'
import SignedBanner from '../components/SignedBanner'
import ConfirmDialog from '../components/ConfirmDialog'
import ExportIdrButton from '../components/ExportIdrButton'
import GoToProjectButton from '../components/GoToProjectButton'
import SignatureSetupModal from '../components/SignatureSetupModal'
import ReviewToolbar from '../components/ReviewToolbar'
import ReturnNotice from '../components/ReturnNotice'
import StatusBadge from '../components/StatusBadge'
import IDRNumberBadge from '../components/IDRNumberBadge'
import EditModeToggle from '../components/EditModeToggle'
import Toast from '../components/Toast'
import { RedlineProvider } from '../contexts/RedlineContext'
import useReviewEditing from '../lib/useReviewEditing'

const SAVE_HEADER_BEFORE_SUBMIT = 'Please save the header before submitting.'
// Demo users can do everything except submit (the backend refuses it too)
const DEMO_SUBMIT_DISABLED = 'Demo mode — submit is disabled'
const ATTESTATION_STATEMENT =
  'I attest that the information in this IDR is accurate and complete to the best of my knowledge.'
const CERTIFICATION_STATEMENT =
  'The above described work was incorporated into this project and was constructed in conformance with all plans, ' +
  'specifications, and standards unless otherwise noted.'

// Where "Back" goes, keyed by the list page that opened the IDR (router state.from): a path under the project, or,
// for the review queue, which spans projects, a path of its own
const BACK_TARGETS = {
  drafts: { path: '/drafts', label: 'Back to Drafts' },
  archive: { path: '/archive', label: 'Back to Archive' },
  review: { to: '/review', label: 'Back to My Tasks' },
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
  const { user } = useAuth()
  const { rolesByProject } = useProjectRoles()
  const { refresh: refreshTaskCount } = useTaskCount()
  const isDemo = Boolean(user?.is_demo)
  const back = BACK_TARGETS[location.state?.from] || BACK_TO_PROJECT
  const backPath = back.to || `/project/${projectId}${back.path}`

  // Initial load; only this shows a spinner
  const [loadStatus, setLoadStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [loadError, setLoadError] = useState(null)
  const [loadAttempt, setLoadAttempt] = useState(0) // bump to retry

  // Server state. savedHeader is the last header the server confirmed; headerForm is what's typed.
  const [idr, setIdr] = useState(null) // header fields + status, without reports
  const [reports, setReports] = useState([])
  const [fieldEdits, setFieldEdits] = useState([]) // every reviewer edit on the IDR, oldest first
  const [savedHeader, setSavedHeader] = useState(null)
  const [headerForm, setHeaderForm] = useState(null)

  // One action at a time: 'header' | 'add' | 'submit' | the report_id being deleted
  const [busyAction, setBusyAction] = useState(null)
  const [headerSave, setHeaderSave] = useState({ status: 'idle', savedAt: null, error: null })
  const [actionError, setActionError] = useState(null) // { scope: 'reports' | 'submit', message }
  const [refreshError, setRefreshError] = useState(null)
  const [certifyOpen, setCertifyOpen] = useState(false) // the certification dialog shown before submitting
  const [signatureSetupOpen, setSignatureSetupOpen] = useState(false) // shown first when the user has no signature yet
  const [signerName, setSignerName] = useState('') // who signed a submitted IDR, for its banner; '' until known

  // A signed IDR's banner names its signer: the IDR's reporter. Usually that is the signed-in user; otherwise the name
  // comes from the user list. Until (or unless) it is known, the banner reads "Submitted on <date>".
  const reporterUuid = idr?.reporter_uuid
  const isSigned = Boolean(idr) && idr.status !== 'draft' && Boolean(idr.inspector_signed_at)
  const isOwnIdr = reporterUuid !== undefined && reporterUuid === user?.uuid
  const ownName = personName(user)
  useEffect(() => {
    if (!isSigned) {
      setSignerName('')
      return
    }
    if (isOwnIdr) {
      setSignerName(ownName)
      return
    }
    if (isDemo) return // demo users aren't allowed the user list (and never reach a signed IDR)
    let ignore = false
    listUsers()
      .then(users => { if (!ignore) setSignerName(personName(users.find(u => u.user_id === reporterUuid))) })
      .catch(() => { if (!ignore) setSignerName('') }) // not worth an error: the banner still says when
    return () => { ignore = true }
  }, [isSigned, isOwnIdr, ownName, reporterUuid, isDemo])

  // Puts a getIdr response into state. resetForm replaces the typed header (initial load only).
  const applyIdr = useCallback((data, { resetForm }) => {
    const { reports: reportRows, field_edits: edits = [], ...idrFields } = data
    const serverHeader = headerFormValues(idrFields)
    setIdr(idrFields)
    setReports(reportRows)
    setFieldEdits(edits)
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

  // Reviewer editing: an edit answers with the IDR as it now stands; a lost race refetches it
  const editing = useReviewEditing({
    idr,
    onIdrUpdated: (data) => applyIdr(data, { resetForm: false }),
    refetch: refresh,
  })

  if (loadStatus === 'loading') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
        <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
        <p className="mt-4 text-gray-600">Loading IDR...</p>
      </div>
    )
  }

  if (loadStatus === 'error') {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-lg shadow-sm p-6 text-center max-w-md">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Couldn't open this IDR</h2>
          <p className="text-red-600 mb-6">{loadError}</p>
          <div className="flex justify-center space-x-3">
            <button onClick={() => setLoadAttempt(a => a + 1)} className="btn-primary">
              Retry
            </button>
            <button onClick={() => navigate(backPath)} className="btn-secondary">
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

  // Blocks on unsaved header edits so what gets submitted is what's on screen, then asks for certification.
  // Submitting signs the IDR, so a user without a signature sets one up first and goes on to certify from there.
  const openCertify = () => {
    if (busy || reports.length === 0) return
    if (headerDirty) {
      window.alert(SAVE_HEADER_BEFORE_SUBMIT)
      return
    }
    if (!user?.has_signature) {
      setSignatureSetupOpen(true)
      return
    }
    setCertifyOpen(true)
  }

  // The dialog stays open while submitting (showing "Working...") and on failure (showing the error)
  const confirmSubmit = async () => {
    let submitFailed = false
    await runAction('submit', () => submitIdr(idrId), message => {
      submitFailed = true
      setActionError({ scope: 'submit', message: `Submit failed: ${message}` })
    })
    if (!submitFailed) {
      setCertifyOpen(false)
      refreshTaskCount() // a submitted IDR is a new task for whoever reviews on this project, the submitter included
    }
  }

  // Each report type has its own form page; only types with a page can be opened (see isReportTypeAvailable)
  // The backend refused to approve the stage: open the report holding the first pay item still waiting on the
  // reviewer, which shows the reason and points at the item
  const showUntouchedPayItem = ({ detail, untouched }) => {
    const report = reports.find(r => r.report_id === untouched[0].report_id)
    if (!report) return
    const segment = reportTypeRoute(report.report_type) || 'general'
    navigate(`/project/${projectId}/idr/${idrId}/${segment}/${report.report_id}`, {
      state: { from: location.state?.from, payItemGate: { itemId: untouched[0].pay_item_id, message: detail } },
    })
  }

  const openReport = (report) => {
    const segment = reportTypeRoute(report.report_type) || 'general'
    navigate(`/project/${projectId}/idr/${idrId}/${segment}/${report.report_id}`, { state: { from: location.state?.from } })
  }

  return (
    <div className="flex-1 bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <button
                onClick={() => navigate(backPath)}
                className="flex items-center space-x-2 text-construction-700 hover:text-construction-800"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="font-medium">{back.label}</span>
              </button>
              {/* Not when Back already goes to the project page */}
              {back !== BACK_TO_PROJECT && <GoToProjectButton onClick={() => navigate(`/project/${projectId}`)} />}
            </div>
            {readOnly && (
              <ExportIdrButton idrId={idrId} isDraft={false} disabled={reports.length === 0} />
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {readOnly && (
          <SignedBanner signedAt={idr.inspector_signed_at} submittedAt={idr.submitted_at} signerName={signerName} />
        )}

        {idr.return_reason && <ReturnNotice reason={idr.return_reason} returnedFrom={idr.returned_from} />}

        {/* Title */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Inspector Daily Report</h1>
            <StatusBadge status={idr.status} returned={Boolean(idr.return_reason)} />
            {(readOnly || idr.idr_number) && <IDRNumberBadge number={idr.idr_number} />}
          </div>
          <p className="text-gray-600 mt-1">
            {/* parseISO keeps a date-only string in local time (new Date() would shift it a day in US zones) */}
            {format(parseISO(idr.report_date), 'EEEE, MMMM d, yyyy')} · Project {projectId}
          </p>
          {idr.status === 'approved' && idr.re_signed_at && (
            <p className="text-sm text-emerald-700 mt-1">
              Approved on {format(parseISO(idr.re_signed_at), "MMM d, yyyy 'at' h:mm a")}
            </p>
          )}
        </div>

        {readOnly && (
          <ReviewToolbar
            idr={idr}
            roles={rolesByProject?.[projectId] || []}
            reports={reports}
            fieldEdits={fieldEdits}
            onChanged={refresh}
            onPayItemsUntouched={showUntouchedPayItem}
            disabled={busy}
          />
        )}

        {refreshError && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 flex items-center justify-between">
            <span>Couldn't refresh this IDR: {refreshError}</span>
            <button onClick={refresh} disabled={busy} className="btn-secondary disabled:opacity-50">
              Retry
            </button>
          </div>
        )}

        {editing.mayEdit && (
          <div className="flex items-center justify-end gap-3 mb-4">
            <span className="text-sm text-gray-500">
              {editing.editMode ? 'Hover a field and click its pencil to edit it.' : 'Turn on edit mode to change a field.'}
            </span>
            <EditModeToggle on={editing.editMode} onToggle={editing.toggleEditMode} />
          </div>
        )}
        <Toast message={editing.toast} onDone={editing.clearToast} />

        {/* Shared header */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="form-section-title">Time & Weather</h2>
          {/* In a reviewer's edit mode the fieldset lets go, so the inline editors work; the inputs stay disabled */}
          <fieldset disabled={readOnly && !editing.editMode} className="min-w-0 border-0 p-0 m-0">
            <RedlineProvider
              value={{
                reportId: null,
                edits: fieldEdits,
                isDraft: !readOnly,
                canEdit: editing.editMode,
                saveField: (fieldPath, newValue) => editing.saveField(null, fieldPath, newValue),
              }}
            >
              <IdrHeaderForm
                values={readOnly ? savedHeader : headerForm}
                onChange={handleHeaderChange}
                disabled={readOnly}
              />
            </RedlineProvider>
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

        {/* Export and Submit */}
        {!readOnly && (
          <div className="flex flex-col items-end space-y-2">
            <div className="flex items-start space-x-3">
              <ExportIdrButton idrId={idrId} isDraft disabled={reports.length === 0 || busy} />
              {/* The tooltip sits on a wrapper: a disabled button doesn't reliably show its own */}
              <span title={isDemo ? DEMO_SUBMIT_DISABLED : undefined}>
                <SubmitReportButton
                  label="Submit IDR"
                  onClick={openCertify}
                  submitting={busyAction === 'submit'}
                  disabled={isDemo || reports.length === 0 || busy}
                />
              </span>
            </div>
            {isDemo ? (
              <p className="text-sm text-gray-500">{DEMO_SUBMIT_DISABLED}</p>
            ) : reports.length === 0 && (
              <p className="text-sm text-gray-500">Add at least one report before submitting.</p>
            )}
            {actionError?.scope === 'submit' && (
              <p role="alert" className="text-sm text-red-600">{actionError.message}</p>
            )}
          </div>
        )}
        <SignatureSetupModal
          isOpen={signatureSetupOpen}
          onClose={() => setSignatureSetupOpen(false)}
          onSuccess={() => setCertifyOpen(true)}
        />
        {certifyOpen && (
          <ConfirmDialog
            title="Certification"
            message={CERTIFICATION_STATEMENT}
            note={ATTESTATION_STATEMENT}
            confirmLabel="Submit"
            cancelLabel="Cancel"
            confirmClassName="btn-primary"
            onConfirm={confirmSubmit}
            onCancel={() => setCertifyOpen(false)}
            busy={busyAction === 'submit'}
            error={actionError?.scope === 'submit' ? actionError.message : null}
          />
        )}
      </main>
    </div>
  )
}
