/**
 * Sidewalk, Curb, Concrete Base (SWCB) report inside an IDR, at /project/:projectId/idr/:idrId/swcb/:reportId.
 * Same load / Save Draft / read-only flow as the General report: the report_data is the form, the IDR's date, times
 * and weather show as a read-only context line, and a submitted IDR (including a 409 mid-edit) locks the form.
 * The Detailed Activity table and Inspection Matrix are placeholders until their components are built.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getIdr, getProjectById, saveReport } from '../../services/api'
import SaveDraftButton from '../../components/SaveDraftButton'
import SubmittedBanner from '../../components/SubmittedBanner'
import SaveStatusText from '../../components/SaveStatusText'
import IdrContextLine from '../../components/IdrContextLine'
import AttachmentsSection from '../../components/AttachmentsSection'
import PayItemsSection from '../../components/reports/PayItemsSection'
import WorkforceSection from '../../components/reports/WorkforceSection'
import EquipmentSection from '../../components/reports/EquipmentSection'
import SafetyChecklistSection from '../../components/reports/SafetyChecklistSection'
import CommentsSection from '../../components/reports/CommentsSection'
import { formDataFromReportData, sharedSectionDefaults } from '../../lib/reportData'

const SUBMITTED_MID_EDIT =
  'This IDR was submitted while you were editing. Your unsaved changes could not be saved. Reloading...'
const SUBMITTED_LABEL = 'This report belongs to an IDR that was submitted'

// Picks this page's report out of a getIdr response; throws the message to show when it can't be opened here
function findSWCBReport(idr, projectId, reportId) {
  if (idr.project_id !== projectId) throw new Error('IDR not found in this project')
  const report = idr.reports.find(r => r.report_id === reportId)
  if (!report) throw new Error('Report not found in this IDR')
  if (report.report_type !== 'SWCB') throw new Error('This report is not a Sidewalk, Curb, Concrete Base report')
  return report
}

// This report's saved report_data as form state (see formDataFromReportData for the shared-section clean-up),
// with missing activity rows and inspection lines filled from the defaults
function formDataFromReport(reportData) {
  const defaults = emptyFormData()
  const data = formDataFromReportData(reportData, defaults)
  data.activity = { ...defaults.activity, ...data.activity }
  data.inspectionMatrix = { ...defaults.inspectionMatrix, ...data.inspectionMatrix }
  return data
}

// One Detailed Activity row and one Inspection Matrix line (Y / N / NA per column, null until answered)
const emptyActivityRow = () => ({ fromStation: '', toStation: '', remarks: '' })
const emptyInspectionLine = () => ({ base: null, sidewalk: null, curb: null })

// A blank SWCB report. Only report-specific fields: date, times and weather come from the IDR.
function emptyFormData() {
  return {
    description: '',
    activity: {
      excavation: emptyActivityRow(),
      formPrep: emptyActivityRow(),
      pour: emptyActivityRow()
    },
    inspectionMatrix: {
      subgradeCompacted: emptyInspectionLine(),
      compactionTestTaken: emptyInspectionLine(),
      sidewalkFoundationPlaced: emptyInspectionLine(),
      roadwayStoneBasePlaced: emptyInspectionLine(),
      curingCompoundApplied: emptyInspectionLine(),
      otherCuringMethods: emptyInspectionLine(),
      rebarInstalled: emptyInspectionLine()
    },
    ...sharedSectionDefaults()
  }
}

export default function SWCBReportPage() {
  const { projectId, idrId, reportId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  // Carry the list the IDR was opened from, so the IDR page's own Back still goes there
  const backToIdr = () => navigate(`/project/${projectId}/idr/${idrId}`, { state: { from: location.state?.from } })

  // Draft save state
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'
  const [savedAt, setSavedAt] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const savingRef = useRef(false)
  const editCountRef = useRef(0) // bumps on every edit; lets a finished save tell if edits happened mid-flight

  // Loading the parent IDR (spinner on first load only; refetches after a save are silent)
  const [loadStatus, setLoadStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [loadError, setLoadError] = useState(null)
  const [loadAttempt, setLoadAttempt] = useState(0) // bump to retry
  const [idr, setIdr] = useState(null) // the parent IDR without its reports (status, date, weather, times)
  const [project, setProject] = useState(null) // the project card's details, loaded with the IDR
  const [idrStatus, setIdrStatus] = useState('draft')
  const [submittedAt, setSubmittedAt] = useState(null)
  const [refreshError, setRefreshError] = useState(null)
  const [conflictMessage, setConflictMessage] = useState(null) // set when a save hit an already-submitted IDR

  const [formData, setFormData] = useState(emptyFormData)

  // IDR-level state only. A refetch never touches the form, so it can't overwrite typing.
  const applyIdr = useCallback(({ reports, ...idrFields }) => {
    setIdr(idrFields)
    setIdrStatus(idrFields.status)
    setSubmittedAt(idrFields.submitted_at ?? null)
  }, [])

  // Replaces the form with this report's saved data (first load, retry, and the reload after a 409)
  const loadForm = useCallback((idr) => {
    const report = findSWCBReport(idr, projectId, reportId)
    applyIdr(idr)
    setFormData(formDataFromReport(report.report_data))
    setHasUnsavedChanges(false)
    setSaveStatus('idle')
    setSavedAt(null)
    setSaveError(null)
  }, [projectId, reportId, applyIdr])

  useEffect(() => {
    let ignore = false
    setLoadStatus('loading')
    setLoadError(null)
    Promise.all([getIdr(idrId), getProjectById(projectId)])
      .then(([idr, project]) => {
        if (ignore) return
        loadForm(idr)
        setProject(project)
        setLoadStatus('ready')
      })
      .catch(err => {
        if (ignore) return
        setLoadError(err.message)
        setLoadStatus('error')
      })
    return () => { ignore = true }
  }, [idrId, projectId, loadAttempt, loadForm])

  // Every form edit goes through here so unsaved-change tracking can't be skipped.
  const updateForm = (updater) => {
    setFormData(updater)
    editCountRef.current += 1
    setHasUnsavedChanges(true)
  }

  const handleInputChange = (field, value) => {
    updateForm(prev => ({ ...prev, [field]: value }))
  }

  const handleNestedInputChange = (parent, field, value) => {
    updateForm(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }))
  }

  const handleSafetyCheckChange = (field, value) => {
    updateForm(prev => ({
      ...prev,
      safetyChecks: {
        ...prev.safetyChecks,
        [field]: value
      }
    }))
  }

  const handleSafetyRemarksChange = (key, value) => {
    updateForm(prev => ({
      ...prev,
      safetyRemarks: {
        ...prev.safetyRemarks,
        [key]: value
      }
    }))
  }

  const addPayItem = () => {
    updateForm(prev => ({
      ...prev,
      payItems: [...prev.payItems, { itemNo: '', budgetCode: '', payQuantity: '', description: '' }]
    }))
  }

  const handlePayItemChange = (index, field, value) => {
    updateForm(prev => ({
      ...prev,
      payItems: prev.payItems.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    }))
  }

  // Trades added beyond the default workforce roles
  const handleAddTrade = (label) => {
    updateForm(prev => ({ ...prev, additionalWorkforce: [...prev.additionalWorkforce, { label, count: '' }] }))
  }

  const handleChangeAdditionalWorkforce = (index, field, value) => {
    updateForm(prev => ({
      ...prev,
      additionalWorkforce: prev.additionalWorkforce.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    }))
  }

  const handleRemoveAdditionalWorkforce = (index) => {
    updateForm(prev => ({ ...prev, additionalWorkforce: prev.additionalWorkforce.filter((_, i) => i !== index) }))
  }

  // Equipment added beyond the default types
  const handleAddEquipment = (label) => {
    updateForm(prev => ({ ...prev, additionalEquipment: [...prev.additionalEquipment, { label, model: '', number: '' }] }))
  }

  const handleChangeAdditionalEquipment = (index, field, value) => {
    updateForm(prev => ({
      ...prev,
      additionalEquipment: prev.additionalEquipment.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    }))
  }

  const handleRemoveAdditionalEquipment = (index) => {
    updateForm(prev => ({ ...prev, additionalEquipment: prev.additionalEquipment.filter((_, i) => i !== index) }))
  }


  // Silent refetch: keeps the IDR's status fresh (and the drafts list order, via its updated_at bump)
  const refresh = async () => {
    try {
      applyIdr(await getIdr(idrId))
      setRefreshError(null)
    } catch (err) {
      setRefreshError(err.message)
    }
  }

  // A 409 means the IDR was submitted elsewhere: say so, then reload the saved report read-only
  const reloadAfterConflict = async () => {
    setConflictMessage(SUBMITTED_MID_EDIT)
    try {
      loadForm(await getIdr(idrId))
      setRefreshError(null)
    } catch (err) {
      setRefreshError(err.message)
    }
  }

  // Saves the whole form, then refetches the IDR
  const handleSaveDraft = async () => {
    if (savingRef.current) return
    savingRef.current = true
    const editCountAtStart = editCountRef.current
    setSaveStatus('saving')
    let saved = false
    let conflict = false
    try {
      const report = await saveReport(idrId, reportId, formData)
      setSavedAt(report.updated_at)
      setSaveError(null)
      setSaveStatus('saved')
      if (editCountRef.current === editCountAtStart) setHasUnsavedChanges(false)
      saved = true
    } catch (err) {
      if (err.status === 409) {
        conflict = true
        setSaveStatus('idle')
      } else {
        setSaveError(err.message)
        setSaveStatus('error')
      }
    } finally {
      savingRef.current = false
    }
    if (conflict) await reloadAfterConflict()
    else if (saved) await refresh()
  }

  if (loadStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
      </div>
    )
  }

  if (loadStatus === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-lg shadow-sm p-6 text-center max-w-md">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Couldn't open this report</h2>
          <p className="text-red-600 mb-6">{loadError}</p>
          <div className="flex justify-center space-x-3">
            <button onClick={() => setLoadAttempt(a => a + 1)} className="btn-primary">
              Retry
            </button>
            <button onClick={backToIdr} className="btn-secondary">
              Back to IDR
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isLocked = idrStatus !== 'draft'
  const isReadOnly = isLocked

  // Rendered in the header and the footer, hidden once the IDR is submitted
  const reportActions = (
    <SaveDraftButton onClick={handleSaveDraft} saving={saveStatus === 'saving'} />
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={backToIdr}
              className="flex items-center space-x-2 text-construction-700 hover:text-construction-800"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-medium">Back to IDR</span>
            </button>
            {isLocked ? (
              <SubmittedBanner submittedAt={submittedAt} label={SUBMITTED_LABEL} />
            ) : (
              <div className="flex items-center space-x-3">
                <SaveStatusText
                  status={saveStatus}
                  savedAt={savedAt}
                  error={saveError}
                  hasUnsavedChanges={hasUnsavedChanges}
                />
                {reportActions}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {conflictMessage && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
            {conflictMessage}
          </div>
        )}

        {refreshError && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 flex items-center justify-between">
            <span>Couldn't refresh this IDR: {refreshError}</span>
            <button onClick={conflictMessage ? reloadAfterConflict : refresh} className="btn-secondary">
              Retry
            </button>
          </div>
        )}
        {/* Project Info Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Sidewalk, Curb, Concrete Base Inspector's Report</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p><span className="font-medium text-construction-700">Contract No:</span> {project.project_id}</p>
              <p><span className="font-medium text-construction-700">Reg. No:</span> {project.registration_code}</p>
              <p><span className="font-medium text-construction-700">Project Description:</span> {project.project_description}</p>
            </div>
            <div>
              <p><span className="font-medium text-construction-700">Borough:</span> {project.borough}</p>
            </div>
          </div>
        </div>

        <IdrContextLine idr={idr} />

        {/* The whole form is read-only once the IDR is submitted */}
        <fieldset disabled={isReadOnly} className="min-w-0 border-0 p-0 m-0">
        {/* Report Details Form */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="form-section">
            <h3 className="form-section-title">Description of Work Performed and Inspected</h3>
            <p className="text-sm text-gray-600 mb-2">
              Specify for Each Operation: Item No., Subcontractor (if any), Location, Nature of Work, Hot/Cold weather Protection and Details.
            </p>
            <textarea
              className="input-field min-h-[200px]"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter detailed description of work performed..."
            />
          </div>
        </div>

        {/* Detailed Activity (placeholder until the activity table is built) */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="form-section-title">Detailed Activity</h3>
          <p className="text-gray-500 italic">
            Activity table (Excavation / Form-Prep / Pour × From Station / To Station / Remarks) — coming in Chunk B3.
          </p>
        </div>

        {/* Inspection Matrix (placeholder until the matrix is built) */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="form-section-title">Inspection Matrix</h3>
          <p className="text-gray-500 italic">
            Inspection matrix (7 lines × Base/Sidewalk/Curb Y/N/NA) — coming in Chunk B3.
          </p>
        </div>

        {/* Pay Items */}
        <PayItemsSection payItems={formData.payItems} onAddItem={addPayItem} onItemChange={handlePayItemChange} disabled={isReadOnly} />

        {/* Workforce and Equipment */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="form-section-title">Workforce and Equipment</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WorkforceSection
              workforce={formData.workforce}
              onChange={(role, value) => handleNestedInputChange('workforce', role, value)}
              additionalWorkforce={formData.additionalWorkforce}
              onAddTrade={handleAddTrade}
              onChangeAdditional={handleChangeAdditionalWorkforce}
              onRemoveAdditional={handleRemoveAdditionalWorkforce}
              disabled={isReadOnly}
            />
            <EquipmentSection
              equipment={formData.equipment}
              onChange={(key, updated) => handleNestedInputChange('equipment', key, updated)}
              additionalEquipment={formData.additionalEquipment}
              onAddEquipment={handleAddEquipment}
              onChangeAdditional={handleChangeAdditionalEquipment}
              onRemoveAdditional={handleRemoveAdditionalEquipment}
              disabled={isReadOnly}
            />
          </div>
        </div>

        {/* Safety Checks */}
        <SafetyChecklistSection
          safetyChecks={formData.safetyChecks}
          onChange={handleSafetyCheckChange}
          remarks={formData.safetyRemarks}
          onRemarksChange={handleSafetyRemarksChange}
          disabled={isReadOnly}
        />

        {/* Comments */}
        <CommentsSection value={formData.comments} onChange={(v) => handleInputChange('comments', v)} disabled={isReadOnly} />
        </fieldset>

        {/* Outside the fieldset so View still works on a submitted IDR */}
        <AttachmentsSection idrId={idrId} reportId={reportId} isSubmitted={isLocked} className="mb-6" />

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => navigate(`/project/${projectId}`)}
            className="btn-secondary"
          >
            Cancel
          </button>
          {!isReadOnly && <div className="flex space-x-3">{reportActions}</div>}
        </div>
      </main>
    </div>
  )
}
