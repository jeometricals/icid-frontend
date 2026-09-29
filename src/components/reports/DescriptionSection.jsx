/**
 * The "Description of Work Performed and Inspected" card: a subheading (the report type's DDC wording) and a textarea.
 * Stateless. Props: value (string), onChange(value), subheading (string), disabled (makes the textarea natively disabled).
 */
export default function DescriptionSection({ value, onChange, subheading, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="form-section">
        <h3 className="form-section-title">Description of Work Performed and Inspected</h3>
        <p className="text-sm text-gray-600 mb-2">{subheading}</p>
        <textarea
          className="input-field min-h-[200px]"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter detailed description of work performed..."
        />
      </div>
    </div>
  )
}
