/**
 * Concrete Cylinder Data (CONC_CYL) addendum, at /project/:projectId/idr/:idrId/conc-cyl/:reportId.
 * Same load / Save Draft / read-only flow as the other report pages (useReportForm + ReportPageShell). Its body follows
 * the DDC "Data Sheet for Concrete Test Cylinders": Testing Laboratory, Delivery & Casting, the Cylinders table,
 * Specific Location of Placement and Remarks. A never-saved report gets its Date Cast pre-filled with the IDR date.
 */
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import useReportForm from '../../lib/useReportForm'
import { isObject } from '../../lib/reportData'
import ReportPageShell from '../../components/reports/ReportPageShell'
import ConcCylTestingLab from '../../components/reports/ConcCylTestingLab'
import ConcCylDeliveryCasting from '../../components/reports/ConcCylDeliveryCasting'
import ConcCylCylindersTable from '../../components/reports/ConcCylCylindersTable'
import ConcCylPlacementLocation from '../../components/reports/ConcCylPlacementLocation'
import CommentsSection from '../../components/reports/CommentsSection'

// One blank row of the Cylinders table
const emptyCylinder = () => ({ class: '', cylinderNo: '', slump: '' })

// A blank Concrete Cylinder Data report. Only report-specific fields: the IDR's date, times and weather come from the IDR.
function emptyFormData() {
  return {
    testingLab: { labName: '', labAddress: '', labPhonePrimary: '', labPhoneAlt: '' },
    deliveryCasting: { dateOfDelivery: '', cyPoured: '', dateCast: '', jobLocation: '' },
    cylinders: [],
    placementLocation: '',
    remarks: ''
  }
}

// This report's saved report_data as form state: defaults for missing keys, one level down too, so partial or
// older saved shapes and cylinder rows missing a field load cleanly
function formDataFromReport(reportData, defaults) {
  const data = { ...defaults, ...reportData }
  for (const section of ['testingLab', 'deliveryCasting']) {
    data[section] = { ...defaults[section], ...(isObject(data[section]) ? data[section] : {}) }
  }
  data.cylinders = Array.isArray(data.cylinders)
    ? data.cylinders.map(cylinder => ({ ...emptyCylinder(), ...cylinder }))
    : []
  return data
}

export default function ConcCylReportPage() {
  const { projectId, idrId, reportId } = useParams()
  const form = useReportForm({
    idrId,
    projectId,
    reportId,
    expectedReportType: 'CONC_CYL',
    emptyFormData,
    formDataFromReport,
  })
  const { formData, isReadOnly, updateForm, loadStatus, idr, report } = form

  // Pre-fill Date Cast with the IDR date, once per visit, and only on a report that has never saved a Date Cast:
  // a value the inspector cleared (and saved) stays cleared
  const didAutofillDateCast = useRef(false)
  const savedDateCast = report?.report_data?.deliveryCasting?.dateCast
  useEffect(() => {
    if (didAutofillDateCast.current) return
    if (loadStatus !== 'ready' || isReadOnly) return
    didAutofillDateCast.current = true
    if (savedDateCast !== undefined || !idr?.report_date) return
    updateForm(prev => ({ ...prev, deliveryCasting: { ...prev.deliveryCasting, dateCast: idr.report_date } }))
  }, [loadStatus, isReadOnly, savedDateCast, idr?.report_date, updateForm])

  const handleAddCylinder = () => {
    updateForm(prev => ({ ...prev, cylinders: [...prev.cylinders, emptyCylinder()] }))
  }

  const handleCylinderChange = (index, field, value) => {
    updateForm(prev => ({
      ...prev,
      cylinders: prev.cylinders.map((cylinder, i) => (i === index ? { ...cylinder, [field]: value } : cylinder))
    }))
  }

  const handleRemoveCylinder = (index) => {
    updateForm(prev => ({ ...prev, cylinders: prev.cylinders.filter((_, i) => i !== index) }))
  }

  return (
    <ReportPageShell title="Concrete Cylinder Data" form={form}>
      <ConcCylTestingLab
        value={formData.testingLab}
        onChange={(field, value) => form.handleNestedInputChange('testingLab', field, value)}
        disabled={isReadOnly}
      />

      <ConcCylDeliveryCasting
        value={formData.deliveryCasting}
        onChange={(field, value) => form.handleNestedInputChange('deliveryCasting', field, value)}
        disabled={isReadOnly}
      />

      <ConcCylCylindersTable
        cylinders={formData.cylinders}
        onAddCylinder={handleAddCylinder}
        onCylinderChange={handleCylinderChange}
        onRemoveCylinder={handleRemoveCylinder}
        disabled={isReadOnly}
      />

      <ConcCylPlacementLocation
        value={formData.placementLocation}
        onChange={(value) => form.handleInputChange('placementLocation', value)}
        disabled={isReadOnly}
      />

      <CommentsSection
        heading="Remarks"
        path="remarks"
        value={formData.remarks}
        onChange={(value) => form.handleInputChange('remarks', value)}
        disabled={isReadOnly}
      />
    </ReportPageShell>
  )
}
