/**
 * A free-text card: a heading and a single textarea. Stateless. Props: value (string), onChange(value) with the new
 * text, heading (default 'Comments, Visitors, Other Work'; e.g. 'Remarks'), disabled (makes the textarea natively disabled),
 * path (the report field the text is saved under, for its reviewer edits; default 'comments').
 */
import RedlinedField from '../RedlinedField'

export default function CommentsSection({
  value, onChange, heading = 'Comments, Visitors, Other Work', disabled = false, path = 'comments',
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">{heading}</h3>
      <RedlinedField path={path} value={value} label={heading} type="textarea">
        <textarea
          className="input-field min-h-[150px]"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter any additional comments, visitor information, or notes about other work..."
        />
      </RedlinedField>
    </div>
  )
}
