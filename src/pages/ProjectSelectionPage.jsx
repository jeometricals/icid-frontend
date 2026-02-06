import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { HardHat, LogOut, Cloud, Sun, CloudRain, User } from 'lucide-react'
import { format } from 'date-fns'
import { PROJECTS } from '../data/mockData'

// Convert PROJECTS object to array for display
const MOCK_PROJECTS = Object.keys(PROJECTS).map(id => ({
  id,
  ...PROJECTS[id]
}))

export default function ProjectSelectionPage() {
  const { user, signOut, isDemoMode } = useAuth()
  const navigate = useNavigate()
  const [weather] = useState({
    temp: 52,
    low: 48,
    high: 59,
    condition: 'Partly Cloudy'
  })

  const handleProjectSelect = (projectId) => {
    navigate(`/project/${projectId}`)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const getWeatherIcon = (condition) => {
    switch (condition) {
      case 'Sunny':
        return <Sun className="h-6 w-6 text-yellow-500" />
      case 'Cloudy':
        return <Cloud className="h-6 w-6 text-gray-400" />
      case 'Rainy':
        return <CloudRain className="h-6 w-6 text-blue-500" />
      default:
        return <Cloud className="h-6 w-6 text-gray-400" />
    }
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
              {/* Weather */}
              <div className="hidden sm:flex items-center space-x-4 text-sm">
                <div className="text-right">
                  <div className="font-semibold text-2xl text-gray-900">{weather.temp}°F</div>
                  <div className="text-xs text-gray-500">{format(new Date(), 'EEEE MMM dd, yyyy')}</div>
                </div>
                <div className="text-left">
                  <div className="flex items-center space-x-1">
                    {getWeatherIcon(weather.condition)}
                    <span className="text-xs">AM</span>
                  </div>
                  <div className="text-xs text-gray-600">Low {weather.low}°</div>
                </div>
                <div className="text-left">
                  <div className="flex items-center space-x-1">
                    {getWeatherIcon(weather.condition)}
                    <span className="text-xs">PM</span>
                  </div>
                  <div className="text-xs text-gray-600">High {weather.high}°</div>
                </div>
              </div>

              {/* User Menu */}
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
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Pick A Project</h2>
          <p className="mt-2 text-gray-600">Select a project to begin your inspection report</p>
        </div>

        {/* Project List */}
        <div className="space-y-4">
          {MOCK_PROJECTS.map((project) => (
            <button
              key={project.id}
              onClick={() => handleProjectSelect(project.id)}
              className="w-full text-left bg-white hover:bg-construction-50 border-2 border-transparent hover:border-construction-300 rounded-lg p-6 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-construction-700 mb-2">{project.contractNo}</h3>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Reg. No:</span> {project.regNo}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Description:</span> {project.description}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Borough:</span> {project.borough}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Contractor:</span> {project.contractor}
                    </p>
                  </div>
                </div>
                <div className="ml-4">
                  <div className="w-12 h-12 bg-construction-100 rounded-full flex items-center justify-center">
                    <span className="text-construction-700 text-xl">→</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Sign-up for Project Button */}
        <div className="mt-8 text-center">
          <button className="btn-secondary">
            Sign-up for a Project
          </button>
        </div>
      </main>
    </div>
  )
}
