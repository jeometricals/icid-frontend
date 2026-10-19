/**
 * As-Builts & Assessments (Slice C; route param :projectId), at /project/:projectId/assessments, reached from the
 * Progress and Assessments page. A tab bar of report types, the tab in the URL (?tab=, the first when there is none or
 * it is unknown) so a view can be linked: "Sidewalk Assessment Summary" (SidewalkAssessmentTab) and "Pedramp
 * Inspection Report" (a "Coming soon" placeholder). A new report type is one more entry in REPORT_TABS. Changing tab
 * drops the other tab's parameters. Back returns to Progress and Assessments.
 */
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import SidewalkAssessmentTab from '../components/SidewalkAssessmentTab'

function ComingSoon() {
  return (
    <div className="bg-white rounded-lg shadow-sm p-10 text-center text-gray-600">
      <p className="text-lg font-medium text-gray-900 mb-1">Coming soon</p>
      <p className="text-sm">The pedestrian ramp inspection report isn't built yet.</p>
    </div>
  )
}

// The report types, in tab order; each tab's Panel takes the project id
export const REPORT_TABS = [
  { id: 'sidewalk', label: 'Sidewalk Assessment Summary', Panel: SidewalkAssessmentTab },
  { id: 'ped-ramp', label: 'Pedramp Inspection Report', Panel: ComingSoon },
]

export default function AssessmentsPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const current = REPORT_TABS.find(tab => tab.id === searchParams.get('tab')) ?? REPORT_TABS[0]
  const { Panel } = current

  return (
    <div className="flex-1 bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate(`/project/${projectId}/progress`)}
          className="flex items-center space-x-2 text-construction-700 hover:text-construction-800 mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Back to Progress and Assessments</span>
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-6">As-Builts & Assessments — {projectId}</h2>

        <div role="tablist" aria-label="Reports" className="flex flex-wrap gap-2 border-b border-gray-200 mb-6">
          {REPORT_TABS.map(tab => {
            const isCurrent = tab.id === current.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`report-tab-${tab.id}`}
                aria-selected={isCurrent}
                aria-controls="report-panel"
                onClick={() => setSearchParams(tab.id === REPORT_TABS[0].id ? {} : { tab: tab.id }, { replace: true })}
                className={`px-4 py-2 -mb-px border-b-2 text-sm font-medium ${isCurrent
                  ? 'border-construction-600 text-construction-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <div role="tabpanel" id="report-panel" aria-labelledby={`report-tab-${current.id}`}>
          <Panel key={current.id} projectId={projectId} />
        </div>
      </main>
    </div>
  )
}
