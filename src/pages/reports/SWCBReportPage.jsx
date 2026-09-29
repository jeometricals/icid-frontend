/**
 * Sidewalk, Curb, Concrete Base (SWCB) report inside an IDR, at /project/:projectId/idr/:idrId/swcb/:reportId.
 * Same load / Save Draft / read-only flow as the General report: the report_data is the form, the IDR's date, times
 * and weather show as a read-only context line, and a submitted IDR (including a 409 mid-edit) locks the form.
 * On top of the shared sections it has the SWCB Detailed Activity table and Inspection Matrix.
 * Load / save / layout: useReportForm + ReportPageShell.
 */
import { useParams } from 'react-router-dom'
import useReportForm from '../../lib/useReportForm'
import { formDataFromReportData, sharedSectionDefaults } from '../../lib/reportData'
import ReportPageShell from '../../components/reports/ReportPageShell'
import DescriptionSection from '../../components/reports/DescriptionSection'
import SWCBActivityTable from '../../components/reports/SWCBActivityTable'
import SWCBInspectionMatrix from '../../components/reports/SWCBInspectionMatrix'
import PayItemsSection from '../../components/reports/PayItemsSection'
import WorkforceEquipmentCard from '../../components/reports/WorkforceEquipmentCard'
import SafetyChecklistSection from '../../components/reports/SafetyChecklistSection'
import CommentsSection from '../../components/reports/CommentsSection'

const DESCRIPTION_SUBHEADING =
  'Specify for Each Operation: Item No., Subcontractor (if any), Location, Nature of Work, Hot/Cold weather Protection and Details.'

// This report's saved report_data as form state (see formDataFromReportData for the shared-section clean-up),
// with missing activity rows and inspection lines filled from the defaults
function formDataFromReport(reportData, defaults) {
  const data = formDataFromReportData(reportData, defaults)
  data.activity = { ...defaults.activity, ...data.activity }
  data.inspectionMatrix = { ...defaults.inspectionMatrix, ...data.inspectionMatrix }
  return data
}

// One Detailed Activity row and one Inspection Matrix line (Y / N / NA per column, null until answered)
const emptyActivityRow = () => ({ fromStation: '', toStation: '', remarks: '' })
const emptyInspectionLine = () => ({ base: null, sidewalk: null, curb: null })

// A blank SWCB report. Only report-specific fields: date, times and weather come from the IDR.
function emptyFormData() {
  return {
    description: '',
    activity: {
      excavation: emptyActivityRow(),
      formPrep: emptyActivityRow(),
      pour: emptyActivityRow()
    },
    inspectionMatrix: {
      subgradeCompacted: emptyInspectionLine(),
      compactionTestTaken: emptyInspectionLine(),
      sidewalkFoundationPlaced: emptyInspectionLine(),
      roadwayStoneBasePlaced: emptyInspectionLine(),
      curingCompoundApplied: emptyInspectionLine(),
      otherCuringMethods: emptyInspectionLine(),
      rebarInstalled: emptyInspectionLine()
    },
    ...sharedSectionDefaults()
  }
}

export default function SWCBReportPage() {
  const { projectId, idrId, reportId } = useParams()
  const form = useReportForm({
    idrId,
    projectId,
    reportId,
    expectedReportType: 'SWCB',
    emptyFormData,
    formDataFromReport,
  })
  const { formData, isReadOnly, updateForm } = form

  const handleActivityChange = (row, field, value) => {
    updateForm(prev => ({
      ...prev,
      activity: {
        ...prev.activity,
        [row]: { ...prev.activity[row], [field]: value }
      }
    }))
  }

  const handleMatrixChange = (rowKey, column, value) => {
    updateForm(prev => ({
      ...prev,
      inspectionMatrix: {
        ...prev.inspectionMatrix,
        [rowKey]: { ...prev.inspectionMatrix[rowKey], [column]: value }
      }
    }))
  }

  return (
    <ReportPageShell title="Sidewalk, Curb, Concrete Base Inspector's Report" form={form}>
      <DescriptionSection
        value={formData.description}
        onChange={(value) => form.handleInputChange('description', value)}
        subheading={DESCRIPTION_SUBHEADING}
        disabled={isReadOnly}
      />

      {/* Detailed Activity */}
      <SWCBActivityTable activity={formData.activity} onChange={handleActivityChange} disabled={isReadOnly} />

      {/* Inspection Matrix */}
      <SWCBInspectionMatrix matrix={formData.inspectionMatrix} onChange={handleMatrixChange} disabled={isReadOnly} />

      {/* Pay Items */}
      <PayItemsSection
        payItems={formData.payItems}
        onAddItem={form.addPayItem}
        onItemChange={form.handlePayItemChange}
        disabled={isReadOnly}
      />

      {/* Workforce and Equipment */}
      <WorkforceEquipmentCard form={form} />

      {/* Safety Checks */}
      <SafetyChecklistSection
        safetyChecks={formData.safetyChecks}
        onChange={form.handleSafetyCheckChange}
        remarks={formData.safetyRemarks}
        onRemarksChange={form.handleSafetyRemarksChange}
        disabled={isReadOnly}
      />

      {/* Comments */}
      <CommentsSection value={formData.comments} onChange={(v) => form.handleInputChange('comments', v)} disabled={isReadOnly} />
    </ReportPageShell>
  )
}
