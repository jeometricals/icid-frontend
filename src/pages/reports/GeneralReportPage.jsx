/**
 * General report inside an IDR, at /project/:projectId/idr/:idrId/report/:reportId.
 * Loads the parent IDR, uses this report's report_data as the form (report-specific fields only; the IDR's date,
 * times and weather show as a read-only context line), and Save Draft PUTs the whole form back
 * and then silently refetches the IDR. Submitting happens on the IDR page; once the IDR is submitted
 * (including mid-edit, detected by a 409 on save) the form renders read-only with a banner.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Paperclip } from 'lucide-react'
import { PROJECTS } from '../../data/mockData'
import { getIdr, saveReport } from '../../services/api'
import SaveDraftButton from '../../components/SaveDraftButton'
import SubmittedBanner from '../../components/SubmittedBanner'
import SaveStatusText from '../../components/SaveStatusText'
import IdrContextLine from '../../components/IdrContextLine'

const SUBMITTED_MID_EDIT =
  'This IDR was submitted while you were editing. Your unsaved changes could not be saved. Reloading...'
const SUBMITTED_LABEL = 'This report belongs to an IDR that was submitted'

// Picks this page's report out of a getIdr response; throws the message to show when it can't be opened here
function findGeneralReport(idr, projectId, reportId) {
  if (idr.project_id !== projectId) throw new Error('IDR not found in this project')
  const report = idr.reports.find(r => r.report_id === reportId)
  if (!report) throw new Error('Report not found in this IDR')
  if (report.report_type !== 'GEN') throw new Error('This report is not a General report')
  return report
}

// Keys older General reports stored in report_data that now live on the IDR (date, sheet, times, temps, weather).
// Dropped when a report loads, so they're never shown or saved again.
const IDR_LEVEL_KEYS = [
  'date', 'sheetNo', 'dayOfWeek',
  'workActivityStart', 'workActivityEnd', 'inspectorTimeStart', 'inspectorTimeEnd',
  'dailyTempLow', 'dailyTempHigh', 'weatherAM', 'weatherPM',
]

// This report's saved report_data as form state: defaults for missing keys, IDR-level keys removed
function formDataFromReport(reportData) {
  const data = { ...emptyFormData(), ...reportData }
  for (const key of IDR_LEVEL_KEYS) delete data[key]
  return data
}

// A blank General report. Only report-specific fields: date, times and weather come from the IDR.
function emptyFormData() {
  return {
    description: '',
    payItems: [],
    workforce: {
      superintendent: '',
      foreman: '',
      operator: '',
      flagger: ''
    },
    equipment: {
      frontEndLoader: { model: '', number: '' },
      backhoe: { model: '', number: '' },
      truckDump: { model: '', number: '' },
      excavator: { model: '', number: '' }
    },
    safetyChecks: {
      plasticBarrels: null,
      pedestrianBarricades: null,
      timberCurbs: null,
      timberBreakawayBarricades: null,
      generalSafety: null,
      localEmergencyAccess: null,
      fencing: null,
      plates: null,
      arrowBoard: null,
      siteCleaned: null
    },
    safetyRemarks: '',
    comments: ''
  }
}

export default function GeneralReportPage() {
  const { projectId, idrId, reportId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const project = PROJECTS[projectId]
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
    const report = findGeneralReport(idr, projectId, reportId)
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
    getIdr(idrId)
      .then(idr => {
        if (ignore) return
        loadForm(idr)
        setLoadStatus('ready')
      })
      .catch(err => {
        if (ignore) return
        setLoadError(err.message)
        setLoadStatus('error')
      })
    return () => { ignore = true }
  }, [idrId, loadAttempt, loadForm])

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

  const addPayItem = () => {
    updateForm(prev => ({
      ...prev,
      payItems: [...prev.payItems, { itemNo: '', budgetCode: '', payQuantity: '', quantityChk: '', description: '' }]
    }))
  }

  const handlePayItemChange = (index, field, value) => {
    updateForm(prev => ({
      ...prev,
      payItems: prev.payItems.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    }))
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

  if (!project) {
    return <div>Project not found</div>
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
          <h1 className="text-2xl font-bold text-gray-900 mb-4">General Inspector's Report</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p><span className="font-medium text-construction-700">Contract No:</span> {project.contractNo}</p>
              <p><span className="font-medium text-construction-700">Reg. No:</span> {project.regNo}</p>
              <p><span className="font-medium text-construction-700">Project Description:</span> {project.description}</p>
            </div>
            <div>
              <p><span className="font-medium text-construction-700">Borough:</span> {project.borough}</p>
              <p><span className="font-medium text-construction-700">Contractor:</span> {project.contractor}</p>
            </div>
          </div>
        </div>

        <IdrContextLine idr={idr} />

        {/* Every form control below is disabled in one place once the parent IDR is submitted */}
        <fieldset disabled={isLocked} className="min-w-0 border-0 p-0 m-0">
        {/* Report Details Form */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="form-section">
            <h3 className="form-section-title">Description of Work Performed and Inspected</h3>
            <p className="text-sm text-gray-600 mb-2">
              Specify for Each Operation: Item No., Subcontractor (if any), Location, Nature of Work, Results and Details.
            </p>
            <textarea
              className="input-field min-h-[200px]"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter detailed description of work performed..."
            />
          </div>
        </div>

        {/* Pay Items */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="form-section-title mb-0">Pay Items</h3>
            <button onClick={addPayItem} className="btn-secondary text-sm">
              Add Item
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item No.</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Budget Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pay Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity CHK</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {formData.payItems.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                      No pay items added. Click "Add Item" to begin.
                    </td>
                  </tr>
                ) : (
                  formData.payItems.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Item No."
                          value={item.itemNo}
                          onChange={(e) => handlePayItemChange(index, 'itemNo', e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Code"
                          value={item.budgetCode}
                          onChange={(e) => handlePayItemChange(index, 'budgetCode', e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Qty"
                          value={item.payQuantity}
                          onChange={(e) => handlePayItemChange(index, 'payQuantity', e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Initials"
                          value={item.quantityChk}
                          onChange={(e) => handlePayItemChange(index, 'quantityChk', e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => handlePayItemChange(index, 'description', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Workforce and Equipment */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="form-section-title">Workforce and Equipment</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Workforce */}
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-3">Work Force</h4>
              <div className="space-y-3">
                {['Superintendent', 'Foreman', 'Operator', 'Flagger'].map((role) => (
                  <div key={role} className="grid grid-cols-2 gap-2">
                    <div className="flex items-center px-3 py-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium text-gray-700">{role}</span>
                    </div>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="No."
                      value={formData.workforce[role.toLowerCase()]}
                      onChange={(e) => handleNestedInputChange('workforce', role.toLowerCase(), e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment */}
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-3">Equipment</h4>
              <div className="space-y-3">
                {[
                  { label: 'Front End Loader', key: 'frontEndLoader' },
                  { label: 'Backhoe', key: 'backhoe' },
                  { label: 'Truck (Dump)', key: 'truckDump' },
                  { label: 'Excavator', key: 'excavator' }
                ].map((equip) => (
                  <div key={equip.key} className="grid grid-cols-3 gap-2">
                    <div className="flex items-center px-3 py-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium text-gray-700">{equip.label}</span>
                    </div>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Model/Size"
                      value={formData.equipment[equip.key].model}
                      onChange={(e) => handleNestedInputChange('equipment', equip.key, { ...formData.equipment[equip.key], model: e.target.value })}
                    />
                    <input
                      type="number"
                      className="input-field"
                      placeholder="No."
                      value={formData.equipment[equip.key].number}
                      onChange={(e) => handleNestedInputChange('equipment', equip.key, { ...formData.equipment[equip.key], number: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Safety Checks */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="form-section-title">End of the Day MPT/Safety Check List</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/2">Item</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Y</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">N</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remarks</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {[
                  { label: 'Plastic Barrels', key: 'plasticBarrels' },
                  { label: 'Pedestrian Barricades', key: 'pedestrianBarricades' },
                  { label: 'Timber Curbs', key: 'timberCurbs' },
                  { label: 'Timber/Breakaway Barricades', key: 'timberBreakawayBarricades' },
                  { label: 'General Safety Conditions', key: 'generalSafety' },
                  { label: 'Local Emergency Access', key: 'localEmergencyAccess' },
                  { label: 'Fencing', key: 'fencing' },
                  { label: 'Plates', key: 'plates' },
                  { label: 'Arrow Board', key: 'arrowBoard' },
                  { label: 'Site Cleaned and Secured', key: 'siteCleaned' }
                ].map((item) => (
                  <tr key={item.key}>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.label}</td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="radio"
                        name={item.key}
                        checked={formData.safetyChecks[item.key] === true}
                        onChange={() => handleSafetyCheckChange(item.key, true)}
                        className="h-4 w-4 text-construction-600 focus:ring-construction-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="radio"
                        name={item.key}
                        checked={formData.safetyChecks[item.key] === false}
                        onChange={() => handleSafetyCheckChange(item.key, false)}
                        className="h-4 w-4 text-construction-600 focus:ring-construction-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input type="text" className="input-field" placeholder="Remarks" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Comments */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="form-section-title">Comments, Visitors, Other Work / Sketches</h3>
          <textarea
            className="input-field min-h-[150px]"
            value={formData.comments}
            onChange={(e) => handleInputChange('comments', e.target.value)}
            placeholder="Enter any additional comments, visitor information, or notes about other work..."
          />
        </div>

        {/* Attachments */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="form-section-title">Attachments</h3>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Paperclip className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Drag and drop files here, or click to browse</p>
            <p className="text-sm text-gray-500">Photos, PDFs, and documents</p>
            <button className="mt-4 btn-secondary">
              Choose Files
            </button>
          </div>
        </div>
        </fieldset>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => navigate(`/project/${projectId}`)}
            className="btn-secondary"
          >
            Cancel
          </button>
          {!isLocked && <div className="flex space-x-3">{reportActions}</div>}
        </div>
      </main>
    </div>
  )
}
