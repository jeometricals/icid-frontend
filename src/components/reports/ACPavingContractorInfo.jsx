/**
 * The Asphaltic Concrete "Paving Contractor Info" card: paving contractor, subcontractor and the Rice No. / Specific
 * Gravity the contractor supplies. Stateless. Props: value ({ pavingContractorName, subcontractor, riceNo }),
 * onChange(field, value), disabled (makes the inputs natively disabled). A reviewer's edit of a field reads in its place.
 */
import RedlinedField from '../RedlinedField'

const FIELDS = [
  { label: 'Paving Contractor Name', key: 'pavingContractorName', type: 'text' },
  { label: 'Subcontractor (if any)', key: 'subcontractor', type: 'text' },
  { label: 'Rice No. / Specific Gravity', key: 'riceNo', type: 'number', step: '0.001', helper: '(Contractor to Supply)' },
]

export default function ACPavingContractorInfo({ value, onChange, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">Paving Contractor Info</h3>
      <div className="space-y-4 max-w-xl">
        {FIELDS.map(field => (
          <div key={field.key}>
            <label htmlFor={`ac-${field.key}`} className="input-label">{field.label}</label>
            <RedlinedField path={`pavingContractor.${field.key}`} value={value[field.key] ?? ''} label={field.label} type={field.type}>
              <input
                id={`ac-${field.key}`}
                type={field.type}
                step={field.step}
                className="input-field"
                value={value[field.key] ?? ''}
                disabled={disabled}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            </RedlinedField>
            {field.helper && <p className="text-xs text-gray-500 mt-1">{field.helper}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
