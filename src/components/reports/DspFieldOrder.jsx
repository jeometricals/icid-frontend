/**
 * The Daily Site Patrol's "Field Order Issued?" card: a Yes / No choice and, once Yes, the field order's number,
 * which is then required (error, shown by the page when a save is blocked without it). Stateless. Props: issued
 * (boolean), number (string or null), error (the message to show, or null), onIssuedChange(boolean),
 * onNumberChange(string), disabled.
 */
import { FIELD_ORDER_NUMBER_MAX_LENGTH } from '../../data/dspForm'

export default function DspFieldOrder({ issued, number, error, onIssuedChange, onNumberChange, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">Field Order</h3>
      <div className="flex flex-wrap items-start gap-6">
        <fieldset>
          <legend className="input-label">Field Order Issued?</legend>
          <div className="flex items-center gap-4 py-2">
            {[{ value: true, label: 'Yes' }, { value: false, label: 'No' }].map(option => (
              <label key={option.label} className="flex items-center gap-2 text-sm text-gray-900">
                <input
                  type="radio"
                  name="dsp-field-order-issued"
                  checked={issued === option.value}
                  disabled={disabled}
                  onChange={() => onIssuedChange(option.value)}
                  className="h-4 w-4 text-construction-600 focus:ring-construction-500"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        {issued && (
          <div className="w-64">
            <label htmlFor="dsp-field-order-number" className="input-label">Field Order No.</label>
            <input
              id="dsp-field-order-number"
              type="text"
              className={`input-field ${error ? 'border-red-500' : ''}`}
              maxLength={FIELD_ORDER_NUMBER_MAX_LENGTH}
              value={number ?? ''}
              disabled={disabled}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'dsp-field-order-number-error' : undefined}
              onChange={(e) => onNumberChange(e.target.value)}
            />
            {error && (
              <p id="dsp-field-order-number-error" role="alert" className="mt-1 text-sm text-red-600">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
