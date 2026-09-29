import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'

// Pages
import LoginPage from './pages/LoginPage'
import ProjectSelectionPage from './pages/ProjectSelectionPage'
import ProjectDashboard from './pages/ProjectDashboard'
import DraftsListPage from './pages/DraftsListPage'
import ReportArchivePage from './pages/ReportArchivePage'
import IDRPage from './pages/IDRPage'
import GeneralReportPage from './pages/reports/GeneralReportPage'
import SWCBReportPage from './pages/reports/SWCBReportPage'
import ConcMixReportPage from './pages/reports/ConcMixReportPage'

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    // Remember where the user was headed so login can send them back
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}

// Report pages used to live at .../report/:reportId, and every one of them was a General
function LegacyReportRedirect() {
  const { projectId, idrId, reportId } = useParams()
  return <Navigate to={`/project/${projectId}/idr/${idrId}/general/${reportId}`} replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <ProjectSelectionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:projectId"
        element={
          <ProtectedRoute>
            <ProjectDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:projectId/drafts"
        element={
          <ProtectedRoute>
            <DraftsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:projectId/archive"
        element={
          <ProtectedRoute>
            <ReportArchivePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:projectId/idr/:idrId"
        element={
          <ProtectedRoute>
            <IDRPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:projectId/idr/:idrId/general/:reportId"
        element={
          <ProtectedRoute>
            <GeneralReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:projectId/idr/:idrId/swcb/:reportId"
        element={
          <ProtectedRoute>
            <SWCBReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:projectId/idr/:idrId/conc-mix/:reportId"
        element={
          <ProtectedRoute>
            <ConcMixReportPage />
          </ProtectedRoute>
        }
      />
      <Route path="/project/:projectId/idr/:idrId/report/:reportId" element={<LegacyReportRedirect />} />
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  )
}

export default App
