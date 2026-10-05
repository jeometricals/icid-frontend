import { Outlet } from 'react-router-dom'
import AppHeader from './AppHeader'
import { LeaveGuardProvider } from '../contexts/LeaveGuardContext'

/**
 * The frame around every signed-in page: the app header on top, the routed page below it filling the rest of the
 * screen (pages size themselves with flex-1, not min-h-screen). Takes no props; renders the nested route.
 */
export default function AppLayout() {
  return (
    <LeaveGuardProvider>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <AppHeader />
        <div className="flex-1 flex flex-col">
          <Outlet />
        </div>
      </div>
    </LeaveGuardProvider>
  )
}
