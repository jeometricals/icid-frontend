/**
 * One Daily Site Patrol checklist (Maintenance of Site, or Maintenance and Protection of Traffic): a row per item,
 * its question, Yes / No / N/A radios and an "If No, provide details" input. A No without details gets an inline
 * warning, which never blocks a save. Stateless. Props: title, idPrefix (unique per checklist, for the radio groups),
 * items ([{ key, question }], the form's order), rows ([{ item, answer, details }], the same order),
 * onRowChange(index, field, value), disabled.
 */
import { AlertTriangle } from 'lucide-react'
import { ANSWERS, DETAILS_MAX_LENGTH, needsDetails } from '../../data/dspForm'

const HEADER_CLASS = 'px-4 py-3 text-xs font-medium text-gray-500 uppercase'

export const NO_DETAILS_WARNING = 'Answered No: add details of what was found.'

export default function DspChecklistSection({ title, idPrefix, items, rows, onRowChange, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">{title}</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className={`${HEADER_CLASS} text-left w-1/2`}>Item</th>
              {ANSWERS.map(answer => (
                <th key={answer.value} className={`${HEADER_CLASS} text-center`}>{answer.label}</th>
              ))}
              <th className={`${HEADER_CLASS} text-left`}>If No, Provide Details</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item, index) => {
              const row = rows[index]
              const warn = needsDetails(row)
              return (
                <tr key={item.key}>
                  <td className="px-4 py-3 text-sm text-gray-900">{item.question}</td>
                  {ANSWERS.map(answer => (
                    <td key={answer.value} className="px-4 py-3 text-center">
                      <input
                        type="radio"
                        name={`${idPrefix}-${item.key}`}
                        aria-label={`${item.question} ${answer.label}`}
                        checked={row.answer === answer.value}
                        disabled={disabled}
                        onChange={() => onRowChange(index, 'answer', answer.value)}
                        className="h-4 w-4 text-construction-600 focus:ring-construction-500"
                      />
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Details"
                      aria-label={`${item.question} Details`}
                      maxLength={DETAILS_MAX_LENGTH}
                      value={row.details ?? ''}
                      disabled={disabled}
                      onChange={(e) => onRowChange(index, 'details', e.target.value)}
                    />
                    {warn && (
                      <p role="status" className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                        {NO_DETAILS_WARNING}
                      </p>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
