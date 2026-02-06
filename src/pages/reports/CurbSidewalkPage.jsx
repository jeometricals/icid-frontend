import { useState, Fragment } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Send, Paperclip } from 'lucide-react'
import { format } from 'date-fns'
import { PROJECTS } from '../../data/mockData'

const DETAILED_ACTIVITIES = [
  { name: 'Excavation', fromSta: '', toSta: '', remarks: '' },
  { name: 'Form / Prep.', fromSta: '', toSta: '', remarks: '' },
  { name: 'Pour', fromSta: '', toSta: '', remarks: '' }
]

const QUALITY_CHECKS = [
  'SUBGRADE COMPACTED:',
  'COMPACTION TEST TAKEN:',
  'SIDEWALK 6" FOUNDATION MATERIAL PLACED AND COMPACTED:',
  'ROADWAY STONE BASE PLACED AND COMPACTED:',
  'CURING COMPOUND APPLIED:',
  'OTHER CURING METHODS:',
  'WAS REBAR INSTALLED IN ACCORDANCE WITH APPROVED SHOP DRAWINGS AND BENDING SCHEDULE?:'
]

export default function CurbSidewalkPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const project = PROJECTS[projectId]

  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    workTypes: {
      curb: false,
      sidewalk: false,
      concreteBase: false,
      structural: false
    },
    description: '',
    detailedActivities: DETAILED_ACTIVITIES,
    qualityChecks: {
      base: { yes: null, no: null, na: null },
      sidewalk: { yes: null, no: null, na: null },
      curb: { yes: null, no: null, na: null }
    },
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
    }
  })

  const handleWorkTypeChange = (type) => {
    setFormData(prev => ({
      ...prev,
      workTypes: {
        ...prev.workTypes,
        [type]: !prev.workTypes[type]
      }
    }))
  }

  const handleQualityCheckChange = (section, checkIndex, status) => {
    setFormData(prev => ({
      ...prev,
      qualityChecks: {
        ...prev.qualityChecks,
        [section]: {
          ...prev.qualityChecks[section],
          [status]: checkIndex
        }
      }
    }))
  }

  const handleActivityChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      detailedActivities: prev.detailedActivities.map((activity, i) =>
        i === index ? { ...activity, [field]: value } : activity
      )
    }))
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
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Inspector's Report - Curb, Sidewalk, Concrete Base & Pedestrian Ramp
          </h1>
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

        {/* Work Type Selection */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="form-section-title">Work Type</h3>
          <div className="flex flex-wrap gap-4">
            {[
              { key: 'curb', label: 'Curb' },
              { key: 'sidewalk', label: 'Sidewalk' },
              { key: 'concreteBase', label: 'Concrete Base' },
              { key: 'structural', label: 'Structural' }
            ].map((type) => (
              <label key={type.key} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.workTypes[type.key]}
                  onChange={() => handleWorkTypeChange(type.key)}
                  className="h-5 w-5 text-construction-600 focus:ring-construction-500 rounded"
                />
                <span className="text-sm font-medium text-gray-700">{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="form-section-title">Description of Work Performed and Inspected</h3>
          <p className="text-sm text-gray-600 mb-2">
            Specify for Each Operation: Item No., Subcontractor (if any), Location, Nature of Work, Results and Details.
          </p>
          <textarea
            className="input-field min-h-[150px]"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Enter detailed description of work performed..."
          />
        </div>

        {/* Detailed Activities */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="form-section-title">Detailed Activities</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From Sta.</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">To Sta.</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remarks</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {formData.detailedActivities.map((activity, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{activity.name}</td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        className="input-field"
                        value={activity.fromSta}
                        onChange={(e) => handleActivityChange(index, 'fromSta', e.target.value)}
                        placeholder="0+00"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        className="input-field"
                        value={activity.toSta}
                        onChange={(e) => handleActivityChange(index, 'toSta', e.target.value)}
                        placeholder="0+00"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        className="input-field"
                        value={activity.remarks}
                        onChange={(e) => handleActivityChange(index, 'remarks', e.target.value)}
                        placeholder="Enter remarks"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quality Checks */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="form-section-title">Quality Assurance Checks</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" rowSpan="2"></th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase" colSpan="3">BASE</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase" colSpan="3">SIDEWALK</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase" colSpan="3">CURB</th>
                </tr>
                <tr>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Yes</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">No</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">N/A</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Yes</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">No</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">N/A</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Yes</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">No</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">N/A</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {QUALITY_CHECKS.map((check, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{check}</td>
                    {['base', 'sidewalk', 'curb'].map((section) => (
                      <Fragment key={section}>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="radio"
                            name={`${section}-${index}`}
                            onChange={() => handleQualityCheckChange(section, index, 'yes')}
                            className="h-4 w-4 text-construction-600 focus:ring-construction-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="radio"
                            name={`${section}-${index}`}
                            onChange={() => handleQualityCheckChange(section, index, 'no')}
                            className="h-4 w-4 text-construction-600 focus:ring-construction-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="radio"
                            name={`${section}-${index}`}
                            onChange={() => handleQualityCheckChange(section, index, 'na')}
                            className="h-4 w-4 text-construction-600 focus:ring-construction-500"
                          />
                        </td>
                      </Fragment>
                    ))}
                  </tr>
                ))}
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
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        equipment: {
                          ...prev.equipment,
                          [equip.key]: { ...prev.equipment[equip.key], model: e.target.value }
                        }
                      }))}
                    />
                    <input
                      type="number"
                      className="input-field"
                      placeholder="No."
                      value={formData.equipment[equip.key].number}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        equipment: {
                          ...prev.equipment,
                          [equip.key]: { ...prev.equipment[equip.key], number: e.target.value }
                        }
                      }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Attachments */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="form-section-title">Attachments</h3>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Paperclip className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Drag and drop files here, or click to browse</p>
            <p className="text-sm text-gray-500">Photos, sketches, and documents</p>
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
