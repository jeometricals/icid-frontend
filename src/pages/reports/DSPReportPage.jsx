/**
 * Daily Site Patrol (DSP) report, at /project/:projectId/idr/:idrId/dsp/:reportId. The IDR's one DSP, a top-level
 * report added from the IDR page's Add report (one filed as an addendum before V4 opens here too). Same load / Save Draft / read-only flow as the other report pages (useReportForm +
 * ReportPageShell). Its body follows DDC's Daily Site Patrol sheet: the patrol details (the date, day, I.R. No. and
 * sheet read-only, the time of patrol entered), the Maintenance of Site and Maintenance and Protection of Traffic
 * checklists and Field Order Issued?. A save with a field order issued but no number is blocked here, as the backend
 * refuses it; a No without details only warns. DSP takes no reviewer edits (no redlines) yet.
 */
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import useReportForm from '../../lib/useReportForm'
import ReportPageShell from '../../components/reports/ReportPageShell'
import DspPatrolMetadata from '../../components/reports/DspPatrolMetadata'
import DspChecklistSection from '../../components/reports/DspChecklistSection'
import DspFieldOrder from '../../components/reports/DspFieldOrder'
import { MOS_ITEMS, MPT_ITEMS, dspFormData, dspSaveError, emptyDspData } from '../../data/dspForm'

const formDataFromReport = (reportData) => dspFormData(reportData)

export default function DSPReportPage() {
  const { projectId, idrId, reportId } = useParams()
  const form = useReportForm({
    idrId,
    projectId,
    reportId,
    expectedReportType: 'DSP',
    emptyFormData: emptyDspData,
    formDataFromReport,
  })
  const { formData, isReadOnly, updateForm, idr } = form
  const [saveBlocked, setSaveBlocked] = useState(false) // a save was refused here; shows the field's error
  const saveError = dspSaveError(formData)

  // Save Draft, and every exit that saves first, stop at the error the backend would give
  const handleSaveDraft = async () => {
    if (saveError) {
      setSaveBlocked(true)
      return false
    }
    return form.handleSaveDraft()
  }
  const navigateSafely = async (action) => {
    if (form.hasUnsavedChanges && !(await handleSaveDraft())) return
    await action()
  }

  const handleRowChange = (checklist) => (index, field, value) => {
    updateForm(prev => ({
      ...prev,
      [checklist]: prev[checklist].map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }))
  }

  return (
    <ReportPageShell title="Daily Site Patrol" form={{ ...form, handleSaveDraft, navigateSafely }}>
      <DspPatrolMetadata
        workDate={idr?.report_date}
        idrNumber={idr?.idr_number}
        timeOfPatrol={formData.timeOfPatrol}
        onTimeOfPatrolChange={(value) => form.handleInputChange('timeOfPatrol', value)}
        disabled={isReadOnly}
      />

      <DspChecklistSection
        title="Maintenance of Site"
        idPrefix="dsp-mos"
        items={MOS_ITEMS}
        rows={formData.mosChecklist}
        onRowChange={handleRowChange('mosChecklist')}
        disabled={isReadOnly}
      />

      <DspChecklistSection
        title="Maintenance and Protection of Traffic"
        idPrefix="dsp-mpt"
        items={MPT_ITEMS}
        rows={formData.mptChecklist}
        onRowChange={handleRowChange('mptChecklist')}
        disabled={isReadOnly}
      />

      <DspFieldOrder
        issued={formData.fieldOrderIssued}
        number={formData.fieldOrderNumber}
        error={saveBlocked ? saveError : null}
        onIssuedChange={(value) => form.handleInputChange('fieldOrderIssued', value)}
        onNumberChange={(value) => form.handleInputChange('fieldOrderNumber', value)}
        disabled={isReadOnly}
      />
    </ReportPageShell>
  )
}
