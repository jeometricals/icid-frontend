/**
 * Sidewalk, Curb, Concrete Base (SWCB) report inside an IDR, at /project/:projectId/idr/:idrId/swcb/:reportId.
 * Same load / Save Draft / read-only flow as the General report: the report_data is the form, the IDR's date, times
 * and weather show as a read-only context line, and a submitted IDR (including a 409 mid-edit) locks the form.
 * On top of the shared sections it has the Operation line (Structural, Subcontractor), the SWCB Detailed Activity table
 * and the Inspection Matrix. Its equipment rows follow the DDC form, which has no Excavator or Pavement Cutter row.
 * Load / save / layout: useReportForm + ReportPageShell.
 */
import { useParams } from 'react-router-dom'
import useReportForm from '../../lib/useReportForm'
import { formDataFromReportData, isObject, sharedSectionDefaults } from '../../lib/reportData'
import ReportPageShell from '../../components/reports/ReportPageShell'
import DescriptionSection from '../../components/reports/DescriptionSection'
import SWCBOperationFields from '../../components/reports/SWCBOperationFields'
import SWCBActivityTable from '../../components/reports/SWCBActivityTable'
import SWCBInspectionMatrix, { COLUMNS, MATRIX_ROWS } from '../../components/reports/SWCBInspectionMatrix'
import { EQUIPMENT_EXTRAS, STANDARD_EQUIPMENT } from '../../components/reports/EquipmentSection'
import PayItemsSection from '../../components/reports/PayItemsSection'
import WorkforceEquipmentCard from '../../components/reports/WorkforceEquipmentCard'
import SafetyChecklistSection from '../../components/reports/SafetyChecklistSection'
import CommentsSection from '../../components/reports/CommentsSection'

const DESCRIPTION_SUBHEADING =
  'Specify for Each Operation: Item No., Subcontractor (if any), Location, Nature of Work, Hot/Cold weather Protection and Details.'

// The DDC Conc Bk form has no Excavator or Pavement Cutter row, so this report doesn't offer them
const SWCB_EQUIPMENT = STANDARD_EQUIPMENT.filter(equip => equip.key !== 'excavator')
const SWCB_EQUIPMENT_EXTRAS = EQUIPMENT_EXTRAS.filter(label => label !== 'Pavement Cutter')
const RETIRED_EQUIPMENT_KEYS = ['excavator', 'pavementCutter']

const ANSWERS = ['Y', 'N', 'NA']

// Saved inspection lines as form state: missing lines from the defaults; on a line that only takes some columns the
// others are null; and the text line keeps text only (older reports saved Y / N / NA there, which loads as blank)
function inspectionMatrixFromSaved(saved, defaults) {
  const matrix = { ...defaults, ...(isObject(saved) ? saved : {}) }
  for (const row of MATRIX_ROWS) {
    const line = isObject(matrix[row.key]) ? matrix[row.key] : {}
    matrix[row.key] = Object.fromEntries(COLUMNS.map(({ key }) => {
      const value = line[key]
      if (row.text) return [key, typeof value === 'string' && !ANSWERS.includes(value) ? value : '']
      return [key, row.columns.includes(key) ? (value ?? null) : null]
    }))
  }
  return matrix
}

// This report's saved report_data as form state (see formDataFromReportData for the shared-section clean-up),
// with missing activity rows filled from the defaults, the inspection lines cleaned up as above, and equipment the
// form has no row for dropped (with a warning: it can't be shown or exported)
function formDataFromReport(reportData, defaults) {
  const data = formDataFromReportData(reportData, defaults)
  data.structural = data.structural === true
  data.subcontractor = typeof data.subcontractor === 'string' ? data.subcontractor : ''
  data.activity = { ...defaults.activity, ...data.activity }
  data.inspectionMatrix = inspectionMatrixFromSaved(data.inspectionMatrix, defaults.inspectionMatrix)
  for (const key of RETIRED_EQUIPMENT_KEYS) {
    if (key in data.equipment) {
      console.warn(`SWCB report: dropping saved "${key}" equipment, which the SWCB form has no row for`, data.equipment[key])
      delete data.equipment[key]
    }
  }
  return data
}

// One Detailed Activity row, one Inspection Matrix line (Y / N / NA per column, null until answered) and the
// matrix's text line
const emptyActivityRow = () => ({ fromStation: '', toStation: '', remarks: '' })
const emptyInspectionLine = () => ({ base: null, sidewalk: null, curb: null })
const emptyTextLine = () => ({ base: '', sidewalk: '', curb: '' })

// A blank SWCB report. Only report-specific fields: date, times and weather come from the IDR.
function emptyFormData() {
  const shared = sharedSectionDefaults()
  return {
    description: '',
    structural: false,
    subcontractor: '',
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
      otherCuringMethods: emptyTextLine(),
      rebarInstalled: emptyInspectionLine()
    },
    ...shared,
    equipment: Object.fromEntries(SWCB_EQUIPMENT.map(({ key }) => [key, shared.equipment[key]])),
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

      {/* Operation: Structural and Subcontractor */}
      <SWCBOperationFields
        structural={formData.structural}
        subcontractor={formData.subcontractor}
        onChange={form.handleInputChange}
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
        onRemoveItem={form.removePayItem}
        contractItems={form.contractItems}
        contractItemsLoading={form.contractItemsLoading}
        contractItemsError={form.contractItemsError}
        disabled={isReadOnly}
      />

      {/* Workforce and Equipment */}
      <WorkforceEquipmentCard form={form} standardEquipment={SWCB_EQUIPMENT} equipmentExtras={SWCB_EQUIPMENT_EXTRAS} />

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
