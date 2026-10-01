/**
 * Asphaltic Concrete (AC) report inside an IDR, at /project/:projectId/idr/:idrId/ac/:reportId.
 * Same load / Save Draft / read-only flow as the other report pages (useReportForm + ReportPageShell). Its body follows
 * the DDC template: Paving Contractor Info, Temperature, Theoretical Max Density, the Pavement Course table, Material
 * Usage for Top and Binder, Pay Items, the AC Requirements Checklist, Tack Coat, the Delivery Ticket Log, then the
 * shared Workforce and Equipment, Safety Check List and Comments.
 */
import { useParams } from 'react-router-dom'
import useReportForm from '../../lib/useReportForm'
import { formDataFromReportData, sharedSectionDefaults } from '../../lib/reportData'
import ReportPageShell from '../../components/reports/ReportPageShell'
import ACPavingContractorInfo from '../../components/reports/ACPavingContractorInfo'
import ACTemperature from '../../components/reports/ACTemperature'
import ACMaxDensity from '../../components/reports/ACMaxDensity'
import ACPavementCourseTable from '../../components/reports/ACPavementCourseTable'
import ACMaterialUsage from '../../components/reports/ACMaterialUsage'
import ACRequirementsChecklist from '../../components/reports/ACRequirementsChecklist'
import ACTackCoat from '../../components/reports/ACTackCoat'
import ACDeliveryTicketLog from '../../components/reports/ACDeliveryTicketLog'
import PayItemsSection from '../../components/reports/PayItemsSection'
import WorkforceEquipmentCard from '../../components/reports/WorkforceEquipmentCard'
import SafetyChecklistSection from '../../components/reports/SafetyChecklistSection'
import CommentsSection from '../../components/reports/CommentsSection'

// One blank row of the Pavement Course table and of the Delivery Ticket Log
const emptyCourse = () => ({
  itemNo: '',
  mixType: '',
  stationFrom: '',
  stationTo: '',
  lane: '',
  length: '',
  width: '',
  course: '',
  designDepth: '',
  area: '',
  weight: ''
})
const emptyTicket = () => ({ location: '', ticketNo: '', temperature: '' })

// One Material Usage card (Top or Binder) and one AC Requirements item (value is 'Y' | 'N' | 'NA', '' until answered)
const emptyMaterialUsage = () => ({
  noOfTickets: '',
  firstTicketNo: '',
  lastTicketNo: '',
  qtyReceived: '',
  qtyUsed: '',
  qtyWasted: ''
})
const emptyRequirement = () => ({ value: '', remarks: '' })

const REQUIREMENT_KEYS = [
  'subgradeCompacted', 'roadwayCleanDry', 'acRollerPerSpec', 'densityTestsTaken', 'spotCheckAcDepth',
  'tackCoatPerSpec', 'tackCoatOnEdges',
]

// A blank Asphaltic Concrete report. Only report-specific fields: date, times and weather come from the IDR.
function emptyFormData() {
  return {
    pavingContractor: { pavingContractorName: '', subcontractor: '', riceNo: '' },
    temperature: { surfaceStart: '', surfaceFinish: '', ambientStart: '', ambientFinish: '' },
    maxDensity: { top: '', binder: '' },
    pavementCourses: [],
    materialUsageTop: emptyMaterialUsage(),
    materialUsageBinder: emptyMaterialUsage(),
    acRequirements: Object.fromEntries(REQUIREMENT_KEYS.map(key => [key, emptyRequirement()])),
    tackCoat: { noOfGallons: '', gallonsPerSy: '', applicationMethod: '' },
    deliveryTickets: [],
    ...sharedSectionDefaults()
  }
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

// Saved object over its defaults; anything that isn't an object (missing, '', an array) loads as the defaults
const mergeSection = (defaults, saved) => ({ ...defaults, ...(isObject(saved) ? saved : {}) })

// Saved rows over a blank row each; anything that isn't an array loads as no rows
const mergeRows = (saved, emptyRow) => (Array.isArray(saved) ? saved.map(row => ({ ...emptyRow(), ...row })) : [])

// This report's saved report_data as form state (see formDataFromReportData for the shared-section clean-up), with
// the AC sections filled from the defaults one level down (two for the requirement items), so partial or older saved
// shapes load cleanly; extra saved keys are kept
function formDataFromReport(reportData, defaults) {
  const data = formDataFromReportData(reportData, defaults)
  for (const section of ['pavingContractor', 'temperature', 'maxDensity', 'materialUsageTop', 'materialUsageBinder', 'tackCoat']) {
    data[section] = mergeSection(defaults[section], data[section])
  }
  const requirements = mergeSection(defaults.acRequirements, data.acRequirements)
  data.acRequirements = Object.fromEntries(
    Object.entries(requirements).map(([key, item]) => [key, mergeSection(emptyRequirement(), item)])
  )
  data.pavementCourses = mergeRows(data.pavementCourses, emptyCourse)
  data.deliveryTickets = mergeRows(data.deliveryTickets, emptyTicket)
  return data
}

export default function ACReportPage() {
  const { projectId, idrId, reportId } = useParams()
  const form = useReportForm({
    idrId,
    projectId,
    reportId,
    expectedReportType: 'AC',
    emptyFormData,
    formDataFromReport,
  })
  const { formData, isReadOnly, updateForm } = form

  const nestedChange = (section) => (field, value) => form.handleNestedInputChange(section, field, value)

  const handleAddCourse = () => {
    updateForm(prev => ({ ...prev, pavementCourses: [...prev.pavementCourses, emptyCourse()] }))
  }

  const handleCourseChange = (index, field, value) => {
    updateForm(prev => ({
      ...prev,
      pavementCourses: prev.pavementCourses.map((course, i) => (i === index ? { ...course, [field]: value } : course))
    }))
  }

  const handleRemoveCourse = (index) => {
    updateForm(prev => ({ ...prev, pavementCourses: prev.pavementCourses.filter((_, i) => i !== index) }))
  }

  const handleAddTicket = () => {
    updateForm(prev => ({ ...prev, deliveryTickets: [...prev.deliveryTickets, emptyTicket()] }))
  }

  const handleTicketChange = (index, field, value) => {
    updateForm(prev => ({
      ...prev,
      deliveryTickets: prev.deliveryTickets.map((ticket, i) => (i === index ? { ...ticket, [field]: value } : ticket))
    }))
  }

  const handleRemoveTicket = (index) => {
    updateForm(prev => ({ ...prev, deliveryTickets: prev.deliveryTickets.filter((_, i) => i !== index) }))
  }

  return (
    <ReportPageShell title="Asphaltic Concrete Inspector's Report" form={form}>
      <ACPavingContractorInfo
        value={formData.pavingContractor}
        onChange={nestedChange('pavingContractor')}
        disabled={isReadOnly}
      />

      <ACTemperature value={formData.temperature} onChange={nestedChange('temperature')} disabled={isReadOnly} />

      <ACMaxDensity value={formData.maxDensity} onChange={nestedChange('maxDensity')} disabled={isReadOnly} />

      <ACPavementCourseTable
        courses={formData.pavementCourses}
        onAddCourse={handleAddCourse}
        onCourseChange={handleCourseChange}
        onRemoveCourse={handleRemoveCourse}
        disabled={isReadOnly}
      />

      <ACMaterialUsage
        heading="Material Usage — Top"
        value={formData.materialUsageTop}
        onChange={nestedChange('materialUsageTop')}
        disabled={isReadOnly}
      />

      <ACMaterialUsage
        heading="Material Usage — Binder"
        value={formData.materialUsageBinder}
        onChange={nestedChange('materialUsageBinder')}
        disabled={isReadOnly}
      />

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

      <ACRequirementsChecklist
        value={formData.acRequirements}
        onChange={(next) => form.handleInputChange('acRequirements', next)}
        disabled={isReadOnly}
      />

      <ACTackCoat value={formData.tackCoat} onChange={nestedChange('tackCoat')} disabled={isReadOnly} />

      <ACDeliveryTicketLog
        tickets={formData.deliveryTickets}
        onAddTicket={handleAddTicket}
        onTicketChange={handleTicketChange}
        onRemoveTicket={handleRemoveTicket}
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
