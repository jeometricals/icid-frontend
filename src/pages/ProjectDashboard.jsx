import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { HardHat, LogOut, Cloud, ArrowLeft, FileText, ClipboardCheck, Building } from 'lucide-react'
import { format } from 'date-fns'
import { PROJECTS, REPORT_TYPES as REPORT_TYPES_DATA } from '../data/mockData'

// Add icons to report types
const REPORT_TYPES = REPORT_TYPES_DATA.map(type => {
  const iconMap = {
    'general': FileText,
    'daily-patrol': ClipboardCheck,
    'curb-sidewalk': Building
  }
  return {
    ...type,
    icon: iconMap[type.id]
  }
})

export default function ProjectDashboard() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { signOut, user, isDemoMode } = useAuth()
  const project = PROJECTS[projectId]

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Project not found</h2>
          <button onClick={() => navigate('/projects')} className="mt-4 btn-primary">
            Back to Projects
          </button>
        </div>
      </div>
    )
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleReportSelect = (reportPath) => {
    navigate(`/project/${projectId}${reportPath}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="bg-construction-600 p-2 rounded-lg">
                <HardHat className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-construction-900">ICID Co.</h1>
                <p className="text-xs text-gray-500">Integrated Construction Information Database</p>
              </div>
            </div>

            {/* Weather & User Info */}
            <div className="flex items-center space-x-6">
              <div className="hidden sm:flex items-center space-x-4 text-sm">
                <div className="text-right">
                  <div className="font-semibold text-2xl text-gray-900">52°F</div>
                  <div className="text-xs text-gray-500">{format(new Date(), 'EEEE MMM dd, yyyy')}</div>
                </div>
                <div className="text-left">
                  <div className="flex items-center space-x-1">
                    <Cloud className="h-6 w-6 text-gray-400" />
                    <span className="text-xs">AM</span>
                  </div>
                  <div className="text-xs text-gray-600">Low 48°</div>
                </div>
                <div className="text-left">
                  <div className="flex items-center space-x-1">
                    <Cloud className="h-6 w-6 text-gray-400" />
                    <span className="text-xs">PM</span>
                  </div>
                  <div className="text-xs text-gray-600">High 59°</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium text-gray-900">
                    {user?.user_metadata?.full_name || user?.email || 'User'}
                  </div>
                  {isDemoMode && (
                    <div className="text-xs text-construction-600 font-medium">Demo Mode</div>
                  )}
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center space-x-2 text-construction-700 hover:text-construction-800 mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Back to Project List</span>
        </button>

        {/* Project Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="text-sm space-y-1">
            <p className="text-gray-600">
              <span className="font-medium text-construction-700">Contract No:</span>{' '}
              <span className="text-construction-900 font-bold">{project.contractNo}</span>
            </p>
            <p className="text-gray-600">
              <span className="font-medium text-construction-700">Reg. No:</span> {project.regNo}
            </p>
            <p className="text-gray-600">
              <span className="font-medium text-construction-700">Project Description:</span> {project.description}
            </p>
            <p className="text-gray-600">
              <span className="font-medium text-construction-700">Borough:</span> {project.borough}
            </p>
            <p className="text-gray-600">
              <span className="font-medium text-construction-700">Contractor:</span> {project.contractor}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <button className="bg-construction-600 text-white p-6 rounded-lg hover:bg-construction-700 transition-colors text-center">
            <h3 className="font-bold text-lg">New Inspector Daily Diary</h3>
          </button>
          <button className="bg-gray-200 text-gray-700 p-6 rounded-lg hover:bg-gray-300 transition-colors text-center">
            <h3 className="font-bold text-lg">Drafts</h3>
          </button>
          <button className="bg-gray-200 text-gray-700 p-6 rounded-lg hover:bg-gray-300 transition-colors text-center">
            <h3 className="font-bold text-lg">Report Archive</h3>
          </button>
        </div>

        {/* Report Types */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Report Types</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {REPORT_TYPES.map((reportType) => {
              const Icon = reportType.icon
              return (
                <button
                  key={reportType.id}
                  onClick={() => handleReportSelect(reportType.path)}
                  className="bg-white hover:bg-construction-50 border-2 border-transparent hover:border-construction-300 rounded-lg p-6 transition-all duration-200 shadow-sm hover:shadow-md text-left"
                >
                  <div className="flex items-start space-x-4">
                    <div className="bg-construction-100 p-3 rounded-lg">
                      <Icon className="h-6 w-6 text-construction-700" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900 mb-1">{reportType.title}</h3>
                      <p className="text-sm text-gray-600">{reportType.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Back Button (bottom) */}
        <div className="text-center">
          <button onClick={() => navigate('/projects')} className="btn-secondary">
            Back to Project Page
          </button>
        </div>
      </main>
    </div>
  )
}
