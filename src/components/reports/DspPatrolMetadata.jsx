/**
 * The Daily Site Patrol's "Patrol" card: the IDR's work date, its day of the week, the I.R. No. and the sheet number,
 * all read-only (the export works them out from the IDR), and the time of patrol, the one field entered here.
 * Stateless. Props: workDate (the IDR's report_date, 'yyyy-MM-dd'), idrNumber (null until a reviewer numbers the IDR),
 * timeOfPatrol ('HH:MM' or null), onTimeOfPatrolChange(value: 'HH:MM' or null), disabled.
 */
import { format, parseISO } from 'date-fns'

export const SHEET_ASSIGNED_AT_EXPORT = 'Assigned at export'

function ReadOnlyValue({ label, children }) {
  return (
    <div>
      <p className="input-label">{label}</p>
      <p className="py-2 text-sm text-gray-900">{children}</p>
    </div>
  )
}

export default function DspPatrolMetadata({ workDate, idrNumber, timeOfPatrol, onTimeOfPatrolChange, disabled = false }) {
  // parseISO keeps a date-only string in local time (new Date() would shift it a day in US zones)
  const day = workDate ? parseISO(workDate) : null
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">Patrol</h3>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <ReadOnlyValue label="Date">{day ? format(day, 'MM/dd/yyyy') : '—'}</ReadOnlyValue>
        <ReadOnlyValue label="Day of Week">{day ? format(day, 'EEEE') : '—'}</ReadOnlyValue>
        <ReadOnlyValue label="I.R. No.">{idrNumber || '—'}</ReadOnlyValue>
        <ReadOnlyValue label="Sheet No.">{SHEET_ASSIGNED_AT_EXPORT}</ReadOnlyValue>
        <div>
          <label htmlFor="dsp-time-of-patrol" className="input-label">Time of Patrol</label>
          <input
            id="dsp-time-of-patrol"
            type="time"
            className="input-field"
            value={timeOfPatrol ?? ''}
            disabled={disabled}
            onChange={(e) => onTimeOfPatrolChange(e.target.value || null)}
          />
        </div>
      </div>
    </div>
  )
}
