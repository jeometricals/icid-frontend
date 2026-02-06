import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Send } from 'lucide-react'
import { PROJECTS } from '../../data/mockData'

const SITE_MAINTENANCE_CHECKS = [
  'Has waste, rubbish and debris been removed from site?',
  'Are all open trenches plated or fully enclosed with adequate fencing?',
  'Are all stored materials/equipment properly secured and protected?',
  'Are all open paved areas swept clean?',
  'Are all trees properly protected?',
  'Is temporary pavement being maintained?'
]

const TRAFFIC_MAINTENANCE_CHECKS = [
  'Is traffic maintained in accordance with approved traffic plan / stipulations?',
  'Are all advanced warning signs in place?',
  'Are all required traffic control signs in place?',
  'Are all tapers and transitions in place?',
  'Are all required barrels in place?',
  'Are sufficient flashing lights in place and working?',
  'Are breakaway barricades installed where required?',
  'Are required arrow boards in place?',
  'Are timber curbs / concrete barriers installed where required?',
  'Is steel pedestrian fencing in place as required?',
  'Is pedestrian access to / from building being maintained?',
  'Is access to all fire hydrants provided?',
  'Are all open sidewalks clean and unobstructed?',
  'Are appropriate signs in place for closed sidewalks?',
  'Is required access to commercial areas properly maintained?',
  'Are adequate flaggers / temporary signs utilized when required?'
]

export default function DailySitePatrolPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const project = PROJECTS[projectId]

  const [formData, setFormData] = useState({
    siteMaintenanceChecks: SITE_MAINTENANCE_CHECKS.reduce((acc, check) => {
      acc[check] = { status: null, details: '' }
      return acc
    }, {}),
    trafficMaintenanceChecks: TRAFFIC_MAINTENANCE_CHECKS.reduce((acc, check) => {
      acc[check] = { status: null, details: '' }
      return acc
    }, {})
  })

  const handleCheckChange = (category, question, status) => {
    setFormData(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [question]: {
          ...prev[category][question],
          status
        }
      }
    }))
  }

  const handleDetailsChange = (category, question, details) => {
    setFormData(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [question]: {
          ...prev[category][question],
          details
        }
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

  const ChecklistSection = ({ title, checks, category }) => (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-construction-300">
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16">YES</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16">NO</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16">N/A</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">If no, Provide Details</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {checks.map((check, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{check}</td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="radio"
                    name={`${category}-${index}`}
                    checked={formData[category][check]?.status === 'yes'}
                    onChange={() => handleCheckChange(category, check, 'yes')}
                    className="h-4 w-4 text-construction-600 focus:ring-construction-500"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="radio"
                    name={`${category}-${index}`}
                    checked={formData[category][check]?.status === 'no'}
                    onChange={() => handleCheckChange(category, check, 'no')}
                    className="h-4 w-4 text-construction-600 focus:ring-construction-500"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="radio"
                    name={`${category}-${index}`}
                    checked={formData[category][check]?.status === 'na'}
                    onChange={() => handleCheckChange(category, check, 'na')}
                    className="h-4 w-4 text-construction-600 focus:ring-construction-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Provide details if NO"
                    value={formData[category][check]?.details || ''}
                    onChange={(e) => handleDetailsChange(category, check, e.target.value)}
                    disabled={formData[category][check]?.status !== 'no'}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Daily Site Patrol</h1>
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

        {/* Checklist Form */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="mb-6">
            <p className="text-sm text-gray-600">
              Complete the following checklist to ensure site safety and maintenance standards are met.
              Mark each item as YES, NO, or N/A (Not Applicable). Provide details for any items marked as NO.
            </p>
          </div>

          <ChecklistSection
            title="Maintenance of Site"
            checks={SITE_MAINTENANCE_CHECKS}
            category="siteMaintenanceChecks"
          />

          <ChecklistSection
            title="Maintenance and Protection of Traffic"
            checks={TRAFFIC_MAINTENANCE_CHECKS}
            category="trafficMaintenanceChecks"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-6">
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
