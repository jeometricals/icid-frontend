/**
 * Concrete Cylinder Data (CONC_CYL) addendum, at /project/:projectId/idr/:idrId/conc-cyl/:reportId.
 * Same load / Save Draft / read-only flow as the other report pages (useReportForm + ReportPageShell). Its body follows
 * the DDC "Data Sheet for Concrete Test Cylinders": Delivery & Casting (with Sheet No. / of and the specific location
 * of placement), the Cylinders table (18 rows at most) and the form's instruction lines. The testing lab's details
 * are not entered in ICID. A never-saved report gets its Date Cast pre-filled with the IDR date.
 */
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import useReportForm from '../../lib/useReportForm'
import { isObject } from '../../lib/reportData'
import ReportPageShell from '../../components/reports/ReportPageShell'
import ConcCylMetadata from '../../components/reports/ConcCylMetadata'
import ConcCylCylindersTable, { MAX_CYLINDERS } from '../../components/reports/ConcCylCylindersTable'
import ConcCylFooter from '../../components/reports/ConcCylFooter'

// One blank row of the Cylinders table. No id: the backend gives a new cylinder its id when the IDR is submitted.
const emptyCylinder = () => ({ class: '', cylinderNo: '', slump: '' })

// A blank Concrete Cylinder Data report. Only report-specific fields: the IDR's date, times and weather come from the IDR.
function emptyFormData() {
  return {
    deliveryCasting: { dateOfDelivery: '', cyPoured: '', dateCast: '', jobLocation: '' },
    sheetNo: '',
    sheetOf: '',
    cylinders: [],
    placementLocation: ''
  }
}

// This report's saved report_data as form state: defaults for missing keys, one level down too, so partial or
// older saved shapes and cylinder rows missing a field load cleanly.
// CYLINDER IDS: every key a saved cylinder has is kept ({ ...cylinder }), and Save Draft sends the whole form back,
// so a cylinder's id returns to the backend unchanged on every save. Do not rebuild cylinders from a fixed list of
// keys here or in the handlers below: dropping an id detaches the reviewer edit history that points at that cylinder.
function formDataFromReport(reportData, defaults) {
  const data = { ...defaults, ...reportData }
  data.deliveryCasting = {
    ...defaults.deliveryCasting,
    ...(isObject(data.deliveryCasting) ? data.deliveryCasting : {})
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
    updateForm(prev => (
      prev.cylinders.length >= MAX_CYLINDERS ? prev : { ...prev, cylinders: [...prev.cylinders, emptyCylinder()] }
    ))
  }

  // Spreads the row, so its id (and any other saved key) stays on it
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
      <ConcCylMetadata
        workDate={idr?.report_date}
        deliveryCasting={formData.deliveryCasting}
        sheetNo={formData.sheetNo}
        sheetOf={formData.sheetOf}
        placementLocation={formData.placementLocation}
        onDeliveryCastingChange={(field, value) => form.handleNestedInputChange('deliveryCasting', field, value)}
        onFieldChange={form.handleInputChange}
        disabled={isReadOnly}
      />

      <ConcCylCylindersTable
        cylinders={formData.cylinders}
        onAddCylinder={handleAddCylinder}
        onCylinderChange={handleCylinderChange}
        onRemoveCylinder={handleRemoveCylinder}
        disabled={isReadOnly}
      />

      <ConcCylFooter />
    </ReportPageShell>
  )
}
