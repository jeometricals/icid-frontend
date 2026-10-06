/**
 * Concrete Truck & Mix Info (CONC_MIX) addendum, at /project/:projectId/idr/:idrId/conc-mix/:reportId.
 * Same load / Save Draft / read-only flow as the other report pages (useReportForm + ReportPageShell). Its body follows
 * the DDC template: Location of Use, Mixer Type, the Trucks table, Concrete Specifications, Material Usage and Remarks
 * (no Description of Work block: the trucks table and its metadata are the description).
 */
import { useParams } from 'react-router-dom'
import useReportForm from '../../lib/useReportForm'
import { isObject } from '../../lib/reportData'
import ReportPageShell from '../../components/reports/ReportPageShell'
import ConcMixLocationOfUse from '../../components/reports/ConcMixLocationOfUse'
import ConcMixMixerType from '../../components/reports/ConcMixMixerType'
import ConcMixTrucksTable from '../../components/reports/ConcMixTrucksTable'
import ConcMixConcreteSpecs from '../../components/reports/ConcMixConcreteSpecs'
import ConcMixMaterialUsage from '../../components/reports/ConcMixMaterialUsage'
import CommentsSection from '../../components/reports/CommentsSection'

// One blank row of the Trucks table (inspectionSticker is 'Y' | 'N' | 'NA', null until answered)
const emptyTruck = () => ({
  truckOrTicketNo: '',
  inspectionSticker: null,
  loadSizeCy: '',
  endBatch: '',
  mixingRevs: '',
  startDischTime: '',
  endDischTime: '',
  slump: '',
  airContent: '',
  concTemp: '',
  cylinderNumbers: ''
})

// A blank Concrete Truck & Mix Info report. Only report-specific fields: date, times and weather come from the IDR.
function emptyFormData() {
  return {
    locationOfUse: { curb: false, sidewalk: false, concreteBase: false, structural: false },
    mixerType: { type: '', otherLabel: '' },
    trucks: [],
    concreteSpecs: { classOfConcrete: '', slumpMin: '', slumpMax: '', airMin: '', airMax: '' },
    materialUsage: {
      batchReportNo: '',
      noOfTickets: '',
      firstTicketNo: '',
      lastTicketNo: '',
      quantityDispatched: '',
      quantityReceived: '',
      quantityUsed: '',
      quantityWasted: ''
    },
    remarks: ''
  }
}

// This report's saved report_data as form state: defaults for missing keys, one level down too, so reports saved by
// the earlier placeholder page (mixerType: '', locationOfUse: {}, …) and truck rows missing a field load cleanly
function formDataFromReport(reportData, defaults) {
  const data = { ...defaults, ...reportData }
  for (const section of ['locationOfUse', 'mixerType', 'concreteSpecs', 'materialUsage']) {
    data[section] = { ...defaults[section], ...(isObject(data[section]) ? data[section] : {}) }
  }
  data.trucks = Array.isArray(data.trucks) ? data.trucks.map(truck => ({ ...emptyTruck(), ...truck })) : []
  return data
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
  const { formData, isReadOnly, updateForm } = form

  const handleAddTruck = () => {
    updateForm(prev => ({ ...prev, trucks: [...prev.trucks, emptyTruck()] }))
  }

  const handleTruckChange = (index, field, value) => {
    updateForm(prev => ({
      ...prev,
      trucks: prev.trucks.map((truck, i) => (i === index ? { ...truck, [field]: value } : truck))
    }))
  }

  const handleRemoveTruck = (index) => {
    updateForm(prev => ({ ...prev, trucks: prev.trucks.filter((_, i) => i !== index) }))
  }

  return (
    <ReportPageShell title="Concrete Truck & Mix Info" form={form}>
      <ConcMixLocationOfUse
        value={formData.locationOfUse}
        onChange={(key, checked) => form.handleNestedInputChange('locationOfUse', key, checked)}
        disabled={isReadOnly}
      />

      <ConcMixMixerType
        value={formData.mixerType}
        onChange={(next) => form.handleInputChange('mixerType', next)}
        disabled={isReadOnly}
      />

      <ConcMixTrucksTable
        trucks={formData.trucks}
        onAddTruck={handleAddTruck}
        onTruckChange={handleTruckChange}
        onRemoveTruck={handleRemoveTruck}
        disabled={isReadOnly}
      />

      <ConcMixConcreteSpecs
        value={formData.concreteSpecs}
        onChange={(field, value) => form.handleNestedInputChange('concreteSpecs', field, value)}
        disabled={isReadOnly}
      />

      <ConcMixMaterialUsage
        value={formData.materialUsage}
        onChange={(field, value) => form.handleNestedInputChange('materialUsage', field, value)}
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
