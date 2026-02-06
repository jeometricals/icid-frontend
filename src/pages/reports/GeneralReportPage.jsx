import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Send, Paperclip } from 'lucide-react'
import { format } from 'date-fns'

// Mock project data
const PROJECTS = {
  'HWS0023': {
    contractNo: 'HWS0023',
    regNo: '2024123457',
    description: 'Installation of Curb, Sidewalk and Ped-Ramp Various locations',
    borough: 'Queens',
    contractor: 'Benny Bowers Contracting Co.'
  }
}

export default function GeneralReportPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const project = PROJECTS[projectId]

  const [formData, setFormData] = useState({
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
  })

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleNestedInputChange = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }))
  }

  const handleSafetyCheckChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      safetyChecks: {
        ...prev.safetyChecks,
        [field]: value
      }
    }))
  }

  const addPayItem = () => {
    setFormData(prev => ({
      ...prev,
      payItems: [...prev.payItems, { itemNo: '', budgetCode: '', payQuantity: '', quantityChk: '', description: '' }]
    }))
  }

  const handleSaveDraft = () => {
    console.log('Saving draft...', formData)
    alert('Draft saved successfully!')
  }

  const handleSubmit = () => {
    console.log('Submitting report...', formData)
    alert('Report submitted successfully!')
    navigate(`/project/${projectId}`)
  }

  if (!project) {
    return <div>Project not found</div>
  }

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
            <div className="flex items-center space-x-3">
              <button onClick={handleSaveDraft} className="btn-secondary flex items-center space-x-2">
                <Save className="h-4 w-4" />
                <span>Save Draft</span>
              </button>
              <button onClick={handleSubmit} className="btn-primary flex items-center space-x-2">
                <Send className="h-4 w-4" />
                <span>Submit Report</span>
              </button>
            </div>
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
                        <input type="text" className="input-field" placeholder="Item No." />
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" className="input-field" placeholder="Code" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" className="input-field" placeholder="Qty" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" className="input-field" placeholder="Initials" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" className="input-field" placeholder="Description" />
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

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => navigate(`/project/${projectId}`)}
            className="btn-secondary"
          >
            Cancel
          </button>
          <div className="flex space-x-3">
            <button onClick={handleSaveDraft} className="btn-secondary flex items-center space-x-2">
              <Save className="h-4 w-4" />
              <span>Save Draft</span>
            </button>
            <button onClick={handleSubmit} className="btn-primary flex items-center space-x-2">
              <Send className="h-4 w-4" />
              <span>Submit Report</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
