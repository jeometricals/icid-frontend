import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'

// Pages
import LoginPage from './pages/LoginPage'
import ProjectSelectionPage from './pages/ProjectSelectionPage'
import ProjectDashboard from './pages/ProjectDashboard'
import GeneralReportPage from './pages/reports/GeneralReportPage'
import DailySitePatrolPage from './pages/reports/DailySitePatrolPage'
import CurbSidewalkPage from './pages/reports/CurbSidewalkPage'

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()

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
    return <Navigate to="/login" replace />
  }

  return children
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
        path="/project/:projectId/report/general"
        element={
          <ProtectedRoute>
            <GeneralReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:projectId/report/daily-patrol"
        element={
          <ProtectedRoute>
            <DailySitePatrolPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:projectId/report/curb-sidewalk"
        element={
          <ProtectedRoute>
            <CurbSidewalkPage />
          </ProtectedRoute>
        }
      />
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
