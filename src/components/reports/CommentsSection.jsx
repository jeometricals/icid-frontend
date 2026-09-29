/**
 * The "Comments, Visitors, Other Work" card: a single free-text textarea. Stateless.
 * Props: value (string), onChange(value) with the new text, disabled (makes the textarea natively disabled).
 */
export default function CommentsSection({ value, onChange, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">Comments, Visitors, Other Work</h3>
      <textarea
        className="input-field min-h-[150px]"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter any additional comments, visitor information, or notes about other work..."
      />
    </div>
  )
}
