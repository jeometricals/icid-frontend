/**
 * Concrete Truck & Mix Info (CONC_MIX) addendum, at /project/:projectId/idr/:idrId/conc-mix/:reportId.
 * Same load / Save Draft / read-only flow as the other report pages (useReportForm + ReportPageShell). Its body is a
 * Description of Work plus placeholder cards for the sections that are still to be built.
 */
import { useParams } from 'react-router-dom'
import useReportForm from '../../lib/useReportForm'
import ReportPageShell from '../../components/reports/ReportPageShell'
import DescriptionSection from '../../components/reports/DescriptionSection'

const DESCRIPTION_SUBHEADING = 'Describe the concrete pour this report covers.'

// The body sections still to be built, shown as placeholder cards in this order
const PLACEHOLDER_SECTIONS = [
  'Location of Use',
  'Mixer Type',
  'Trucks',
  'Concrete Specifications',
  'Material Usage',
  'Remarks',
]

// A blank Concrete Truck & Mix Info report. Only report-specific fields: date, times and weather come from the IDR.
function emptyFormData() {
  return {
    description: '',
    locationOfUse: {},
    mixerType: '',
    trucks: [],
    concreteSpecs: {},
    materialUsage: {},
    remarks: ''
  }
}

// This report's saved report_data as form state: defaults for missing keys
function formDataFromReport(reportData, defaults) {
  return { ...defaults, ...reportData }
}

export default function ConcMixReportPage() {
  const { projectId, idrId, reportId } = useParams()
  const form = useReportForm({
    idrId,
    projectId,
    reportId,
    expectedReportType: 'CONC_MIX',
    emptyFormData,
    formDataFromReport,
  })
  const { formData, isReadOnly } = form

  return (
    <ReportPageShell title="Concrete Truck & Mix Info" form={form}>
      <DescriptionSection
        value={formData.description}
        onChange={(value) => form.handleInputChange('description', value)}
        subheading={DESCRIPTION_SUBHEADING}
        disabled={isReadOnly}
      />

      {/* Placeholders until the Concrete Truck & Mix Info sections are built */}
      {PLACEHOLDER_SECTIONS.map(title => (
        <div key={title} className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="form-section-title">{title}</h3>
          <p className="text-gray-500 italic">{title} — coming in Chunk C1b.</p>
        </div>
      ))}
    </ReportPageShell>
  )
}
