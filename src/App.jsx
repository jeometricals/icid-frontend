import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProjectRolesProvider } from './contexts/ProjectRolesContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'

// Pages
import LoginPage from './pages/LoginPage'
import ProjectSelectionPage from './pages/ProjectSelectionPage'
import ProjectDashboard from './pages/ProjectDashboard'
import DraftsListPage from './pages/DraftsListPage'
import ReportArchivePage from './pages/ReportArchivePage'
import IDRPage from './pages/IDRPage'
import ReviewQueuePage from './pages/ReviewQueuePage'
import GeneralReportPage from './pages/reports/GeneralReportPage'
import SWCBReportPage from './pages/reports/SWCBReportPage'
import ConcMixReportPage from './pages/reports/ConcMixReportPage'
import ConcCylReportPage from './pages/reports/ConcCylReportPage'
import ACReportPage from './pages/reports/ACReportPage'

// Report pages used to live at .../report/:reportId, and every one of them was a General
function LegacyReportRedirect() {
  const { projectId, idrId, reportId } = useParams()
  return <Navigate to={`/project/${projectId}/idr/${idrId}/general/${reportId}`} replace />
}

function AppRoutes() {
  return (
    <Routes>
      {/* The only page open to someone who isn't signed in */}
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        {/* Every signed-in page sits under the app header */}
        <Route element={<AppLayout />}>
          <Route path="/projects" element={<ProjectSelectionPage />} />
          <Route path="/review" element={<ReviewQueuePage />} />
          <Route path="/project/:projectId" element={<ProjectDashboard />} />
          <Route path="/project/:projectId/drafts" element={<DraftsListPage />} />
          <Route path="/project/:projectId/archive" element={<ReportArchivePage />} />
          <Route path="/project/:projectId/idr/:idrId" element={<IDRPage />} />
          <Route path="/project/:projectId/idr/:idrId/general/:reportId" element={<GeneralReportPage />} />
          <Route path="/project/:projectId/idr/:idrId/swcb/:reportId" element={<SWCBReportPage />} />
          <Route path="/project/:projectId/idr/:idrId/ac/:reportId" element={<ACReportPage />} />
          <Route path="/project/:projectId/idr/:idrId/conc-mix/:reportId" element={<ConcMixReportPage />} />
          <Route path="/project/:projectId/idr/:idrId/conc-cyl/:reportId" element={<ConcCylReportPage />} />
        </Route>
        <Route path="/project/:projectId/idr/:idrId/report/:reportId" element={<LegacyReportRedirect />} />
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ProjectRolesProvider>
          <AppRoutes />
        </ProjectRolesProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
