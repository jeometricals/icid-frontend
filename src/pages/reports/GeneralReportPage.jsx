/**
 * General Inspector's Report form for one project (route param :projectId).
 * Opens a saved draft when the URL has ?report_id=; otherwise starts blank and puts the new report_id
 * in the URL on first save. Save Draft saves the whole form; Submit locks a saved draft.
 * A submitted report (however it was reached) renders read-only with a "Submitted at" banner.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Lock, Paperclip } from 'lucide-react'
import { format } from 'date-fns'
import { PROJECTS } from '../../data/mockData'
import { useAuth } from '../../contexts/AuthContext'
import { createReport, getReport, saveGeneralForm, submitReport } from '../../services/api'
import SaveDraftButton from '../../components/SaveDraftButton'
import SubmitReportButton from '../../components/SubmitReportButton'

const SUBMIT_CONFIRM = "Submit this report? You won't be able to edit it after."
const SAVE_BEFORE_SUBMIT = 'Please save your changes before submitting.'

// A blank General Form, dated today. Keys match the backend's GeneralFormData (camelCase).
function emptyFormData() {
  return {
    date: format(new Date(), 'yyyy-MM-dd'),
    sheetNo: '',
    workActivityStart: '',
    workActivityEnd: '',
    inspectorTimeStart: '',
    inspectorTimeEnd: '',
    dailyTempLow: '',
    dailyTempHigh: '',
    weatherAM: '',
    weatherPM: '',
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
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const project = PROJECTS[projectId]
  const [searchParams, setSearchParams] = useSearchParams()
  const urlReportId = searchParams.get('report_id')

  // Draft save state. reportId is kept once created, even if the form save after it fails,
  // so retries reuse the same report row.
  const [reportId, setReportId] = useState(null)
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'
  const [savedAt, setSavedAt] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const savingRef = useRef(false)
  const editCountRef = useRef(0) // bumps on every edit; lets a finished save tell if edits happened mid-flight

  // Loading a saved draft from ?report_id=. formReportIdRef is the report the form currently holds;
  // it updates synchronously so our own URL update after a first save is never mistaken for "open a different draft".
  const [loadStatus, setLoadStatus] = useState(urlReportId ? 'loading' : 'ready') // 'loading' | 'ready' | 'error'
  const [loadError, setLoadError] = useState(null)
  const [loadAttempt, setLoadAttempt] = useState(0) // bump to retry
  const [reportStatus, setReportStatus] = useState('draft')
  const [submittedAt, setSubmittedAt] = useState(null)

  // Submit state. submitMessage holds a failed-submit error (cleared by the next successful save or submit).
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState(null)
  const formReportIdRef = useRef(null)

  const [formData, setFormData] = useState(emptyFormData)

  useEffect(() => {
    if (!urlReportId || urlReportId === formReportIdRef.current) return
    let ignore = false
    setLoadStatus('loading')
    setLoadError(null)
    getReport(urlReportId)
      .then(report => {
        if (ignore) return
        formReportIdRef.current = report.report_id
        setReportId(report.report_id)
        setReportStatus(report.status)
        setSubmittedAt(report.submitted_at ?? null)
        setSubmitMessage(null)
        setFormData({ ...emptyFormData(), ...(report.general_form || {}) })
        setHasUnsavedChanges(false)
        setSaveStatus('idle')
        setSavedAt(null)
        setSaveError(null)
        setLoadStatus('ready')
      })
      .catch(err => {
        if (ignore) return
        setLoadError(err.message)
        setLoadStatus('error')
      })
    return () => { ignore = true }
  }, [urlReportId, loadAttempt])

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

  // First save creates the report, later saves (and retries after an error) reuse its id.
  const handleSaveDraft = async () => {
    if (savingRef.current) return
    savingRef.current = true
    const editCountAtStart = editCountRef.current
    setSaveStatus('saving')
    try {
      let id = reportId
      if (!id) {
        const report = await createReport({
          projectId,
          reporterUuid: user.id,
          reportDate: formData.date
        })
        id = report.report_id
        formReportIdRef.current = id
        setReportId(id)
        // Refresh-safe from here on; replace so Back doesn't return to the blank-form URL
        setSearchParams({ report_id: id }, { replace: true })
      }
      const saved = await saveGeneralForm(id, formData)
      setSavedAt(saved.saved_at)
      setSaveError(null)
      setSaveStatus('saved')
      if (editCountRef.current === editCountAtStart) {
        setHasUnsavedChanges(false)
        setSubmitMessage(null)
      }
    } catch (err) {
      setSaveError(err.message)
      setSaveStatus('error')
    } finally {
      savingRef.current = false
    }
  }

  // Blocks on unsaved edits so only what's on the server gets submitted; the response drives the lock.
  const handleSubmit = async () => {
    if (submitting || saveStatus === 'saving') return
    // A never-saved report has nothing on the server to submit, so it gets the same message
    if (hasUnsavedChanges || !reportId) {
      window.alert(SAVE_BEFORE_SUBMIT)
      return
    }
    if (!window.confirm(SUBMIT_CONFIRM)) return
    setSubmitting(true)
    setSubmitMessage(null)
    try {
      const report = await submitReport(reportId)
      setReportStatus(report.status)
      setSubmittedAt(report.submitted_at)
    } catch (err) {
      setSubmitMessage(`Submit failed: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
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
          <h2 className="text-lg font-bold text-gray-900 mb-2">Couldn't open this draft</h2>
          <p className="text-red-600 mb-6">{loadError}</p>
          <div className="flex justify-center space-x-3">
            <button onClick={() => setLoadAttempt(a => a + 1)} className="btn-primary">
              Retry
            </button>
            <button onClick={() => navigate(`/project/${projectId}/drafts`)} className="btn-secondary">
              Back to Drafts
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isLocked = reportStatus !== 'draft'

  // Save + Submit controls; rendered in the header and the footer, hidden once the report is locked.
  const reportActions = (
    <>
      <SaveDraftButton onClick={handleSaveDraft} saving={saveStatus === 'saving'} disabled={submitting} />
      <SubmitReportButton
        onClick={handleSubmit}
        submitting={submitting}
        disabled={saveStatus === 'saving'}
      />
    </>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(`/project/${projectId}`)}
              className="flex items-center space-x-2 text-construction-700 hover:text-construction-800"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-medium">Back to Project Page</span>
            </button>
            {isLocked ? (
              <SubmittedBanner submittedAt={submittedAt} />
            ) : (
              <div className="flex items-center space-x-3">
                {submitMessage ? (
                  <span role="alert" className="text-sm text-red-600">{submitMessage}</span>
                ) : (
                  <SaveStatusText
                    status={saveStatus}
                    savedAt={savedAt}
                    error={saveError}
                    hasUnsavedChanges={hasUnsavedChanges}
                  />
                )}
                {reportActions}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

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

        {/* Every form control below is disabled in one place once the report is submitted */}
        <fieldset disabled={isLocked} className="min-w-0 border-0 p-0 m-0">
        {/* Report Details Form */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="form-section">
            <h3 className="form-section-title">Report Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="input-label">Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                />
              </div>
              <div>
                <label className="input-label">Sheet No.</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.sheetNo}
                  onChange={(e) => handleInputChange('sheetNo', e.target.value)}
                  placeholder="Sheet number"
                />
              </div>
              <div>
                <label className="input-label">Day of Week</label>
                <input
                  type="text"
                  className="input-field"
                  value={format(new Date(formData.date), 'EEEE')}
                  disabled
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">Time & Weather</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="input-label">Work Activity Start</label>
                <input
                  type="time"
                  className="input-field"
                  value={formData.workActivityStart}
                  onChange={(e) => handleInputChange('workActivityStart', e.target.value)}
                />
              </div>
              <div>
                <label className="input-label">Work Activity End</label>
                <input
                  type="time"
                  className="input-field"
                  value={formData.workActivityEnd}
                  onChange={(e) => handleInputChange('workActivityEnd', e.target.value)}
                />
              </div>
              <div>
                <label className="input-label">Inspector Time Start</label>
                <input
                  type="time"
                  className="input-field"
                  value={formData.inspectorTimeStart}
                  onChange={(e) => handleInputChange('inspectorTimeStart', e.target.value)}
                />
              </div>
              <div>
                <label className="input-label">Inspector Time End</label>
                <input
                  type="time"
                  className="input-field"
                  value={formData.inspectorTimeEnd}
                  onChange={(e) => handleInputChange('inspectorTimeEnd', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <div>
                <label className="input-label">Daily Temp Low (°F)</label>
                <input
                  type="number"
                  className="input-field"
                  value={formData.dailyTempLow}
                  onChange={(e) => handleInputChange('dailyTempLow', e.target.value)}
                  placeholder="48"
                />
              </div>
              <div>
                <label className="input-label">Daily Temp High (°F)</label>
                <input
                  type="number"
                  className="input-field"
                  value={formData.dailyTempHigh}
                  onChange={(e) => handleInputChange('dailyTempHigh', e.target.value)}
                  placeholder="59"
                />
              </div>
              <div>
                <label className="input-label">Weather AM</label>
                <select
                  className="input-field"
                  value={formData.weatherAM}
                  onChange={(e) => handleInputChange('weatherAM', e.target.value)}
                >
                  <option value="">Select...</option>
                  <option value="Clear">Clear</option>
                  <option value="Cloudy">Cloudy</option>
                  <option value="Rainy">Rainy</option>
                  <option value="Snowy">Snowy</option>
                </select>
              </div>
              <div>
                <label className="input-label">Weather PM</label>
                <select
                  className="input-field"
                  value={formData.weatherPM}
                  onChange={(e) => handleInputChange('weatherPM', e.target.value)}
                >
                  <option value="">Select...</option>
                  <option value="Clear">Clear</option>
                  <option value="Cloudy">Cloudy</option>
                  <option value="Rainy">Rainy</option>
                  <option value="Snowy">Snowy</option>
                </select>
              </div>
            </div>
          </div>

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

/**
 * Lock notice shown in the header in place of the Save/Submit controls once a report is submitted.
 * Props: submittedAt (ISO string, or null for a report submitted before submit times were recorded).
 */
function SubmittedBanner({ submittedAt }) {
  const when = submittedAt ? ` at ${format(new Date(submittedAt), "HH:mm 'on' MMMM d, yyyy")}` : ''
  return (
    <div className="flex items-center space-x-2 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 py-2 text-sm font-medium">
      <Lock className="h-4 w-4" />
      <span>Submitted{when}</span>
    </div>
  )
}

/**
 * One-line save status shown next to the Save Draft button: error, last saved time, or unsaved changes.
 * Props: status, savedAt (ISO string or null), error (message or null), hasUnsavedChanges.
 */
function SaveStatusText({ status, savedAt, error, hasUnsavedChanges }) {
  if (status === 'error') {
    return <span className="text-sm text-red-600">Save failed: {error}. Click Save Draft to retry.</span>
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
