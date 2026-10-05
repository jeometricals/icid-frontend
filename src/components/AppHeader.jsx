import { Link, useNavigate } from 'react-router-dom'
import { HardHat } from 'lucide-react'
import { useGuardedLeave } from '../contexts/LeaveGuardContext'
import UserMenu from './UserMenu'

/**
 * The app's top bar, on every signed-in page: the ICID Co. logo (a link to the project list) and the user menu
 * (the user's name, their signature, Sign Out). Leaving through the logo goes through the page's leave guard, so a
 * report form saves unsaved edits first.
 * Takes no props.
 */
export default function AppHeader() {
  const navigate = useNavigate()
  const leave = useGuardedLeave()

  const goToProjects = (event) => {
    event.preventDefault()
    leave(() => navigate('/projects'))
  }

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo: home, i.e. the project list */}
          <Link
            to="/projects"
            onClick={goToProjects}
            aria-label="ICID Co. — go to the project list"
            className="flex items-center space-x-3 rounded-lg cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-construction-500 focus:ring-offset-2"
          >
            <div className="bg-construction-600 p-2 rounded-lg">
              <HardHat className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-construction-900">ICID Co.</h1>
              <p className="text-xs text-gray-500">Integrated Construction Information Database</p>
            </div>
          </Link>

          <UserMenu />
        </div>
      </div>
    </header>
  )
}
