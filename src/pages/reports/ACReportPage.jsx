/**
 * Asphaltic Concrete (AC) report inside an IDR, at /project/:projectId/idr/:idrId/ac/:reportId.
 * Same load / Save Draft / read-only flow as the other report pages (useReportForm + ReportPageShell). Its body follows
 * the DDC template: the shared sections are wired, the AC-specific sections are placeholder cards until they're built.
 */
import { useParams } from 'react-router-dom'
import useReportForm from '../../lib/useReportForm'
import { formDataFromReportData, sharedSectionDefaults } from '../../lib/reportData'
import ReportPageShell from '../../components/reports/ReportPageShell'
import PayItemsSection from '../../components/reports/PayItemsSection'
import WorkforceEquipmentCard from '../../components/reports/WorkforceEquipmentCard'
import SafetyChecklistSection from '../../components/reports/SafetyChecklistSection'
import CommentsSection from '../../components/reports/CommentsSection'

// A blank Asphaltic Concrete report. Only report-specific fields: date, times and weather come from the IDR.
function emptyFormData() {
  return sharedSectionDefaults()
}

// Placeholder card for an AC section that is still to be built
function PlaceholderSection({ title }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">{title}</h3>
      <p className="text-gray-500 italic">{title} — coming in Chunk E3.</p>
    </div>
  )
}

export default function ACReportPage() {
  const { projectId, idrId, reportId } = useParams()
  const form = useReportForm({
    idrId,
    projectId,
    reportId,
    expectedReportType: 'AC',
    emptyFormData,
    formDataFromReport: formDataFromReportData,
  })
  const { formData, isReadOnly } = form

  return (
    <ReportPageShell title="Asphaltic Concrete Inspector's Report" form={form}>
      <PlaceholderSection title="Paving Contractor Info" />
      <PlaceholderSection title="Temperature" />
      <PlaceholderSection title="Theoretical Max Density" />
      <PlaceholderSection title="Pavement Course Table" />
      <PlaceholderSection title="Material Usage — Top" />
      <PlaceholderSection title="Material Usage — Binder" />

      {/* Pay Items */}
      <PayItemsSection
        payItems={formData.payItems}
        onAddItem={form.addPayItem}
        onItemChange={form.handlePayItemChange}
        disabled={isReadOnly}
      />

      <PlaceholderSection title="AC Requirements Checklist" />
      <PlaceholderSection title="Tack Coat" />
      <PlaceholderSection title="Delivery Ticket Log" />

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
