/**
 * The Concrete Cylinder Data "Delivery & Casting" card: the work date's day of week (read-only), date of delivery,
 * cubic yards poured, date cast and job location in a 2-column grid, then Sheet No. / of and the specific location
 * of placement. Stateless. Props: workDate (the IDR's report_date, 'yyyy-MM-dd'),
 * deliveryCasting ({ dateOfDelivery, cyPoured, dateCast, jobLocation }), sheetNo, sheetOf, placementLocation,
 * onDeliveryCastingChange(field, value), onFieldChange(key, value) for the other three,
 * disabled (makes the inputs natively disabled).
 */
import { format, parseISO } from 'date-fns'

const FIELDS = [
  { label: 'Date of Delivery', key: 'dateOfDelivery', type: 'date' },
  { label: 'C.Y. Poured', key: 'cyPoured', type: 'number' },
  { label: 'Date Cast', key: 'dateCast', type: 'date' },
  { label: 'Job Location', key: 'jobLocation', type: 'text' },
]

export default function ConcCylMetadata({
  workDate,
  deliveryCasting,
  sheetNo,
  sheetOf,
  placementLocation,
  onDeliveryCastingChange,
  onFieldChange,
  disabled = false,
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">Delivery &amp; Casting</h3>
      {workDate && (
        <p className="text-sm text-gray-700 mb-4">
          {/* parseISO keeps a date-only string in local time (new Date() would shift it a day in US zones) */}
          <span className="font-medium text-construction-700">Day of Week:</span> {format(parseISO(workDate), 'EEEE')}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map(field => (
          <div key={field.key}>
            <label htmlFor={`conc-cyl-${field.key}`} className="input-label">{field.label}</label>
            <input
              id={`conc-cyl-${field.key}`}
              type={field.type}
              step={field.type === 'number' ? '0.01' : undefined}
              className="input-field"
              value={deliveryCasting[field.key] ?? ''}
              disabled={disabled}
              onChange={(e) => onDeliveryCastingChange(field.key, e.target.value)}
            />
          </div>
        ))}
        <div className="flex items-end gap-3">
          <div className="w-28">
            <label htmlFor="conc-cyl-sheetNo" className="input-label">Sheet No.</label>
            <input
              id="conc-cyl-sheetNo"
              type="text"
              className="input-field"
              value={sheetNo ?? ''}
              disabled={disabled}
              onChange={(e) => onFieldChange('sheetNo', e.target.value)}
            />
          </div>
          <span className="pb-2 text-gray-600">of</span>
          <div className="w-28">
            <input
              type="text"
              className="input-field"
              aria-label="Sheet No. of"
              value={sheetOf ?? ''}
              disabled={disabled}
              onChange={(e) => onFieldChange('sheetOf', e.target.value)}
            />
          </div>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="conc-cyl-placementLocation" className="input-label">Specific Location of Placement</label>
          <textarea
            id="conc-cyl-placementLocation"
            rows={3}
            className="input-field"
            value={placementLocation ?? ''}
            disabled={disabled}
            onChange={(e) => onFieldChange('placementLocation', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
