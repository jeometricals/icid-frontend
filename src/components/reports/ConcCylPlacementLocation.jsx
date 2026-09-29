/**
 * The Concrete Cylinder Data "Specific Location of Placement" card: one full-width textarea.
 * Stateless. Props: value (string), onChange(value), disabled (makes the textarea natively disabled).
 */
export default function ConcCylPlacementLocation({ value, onChange, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">
        <label htmlFor="conc-cyl-placementLocation">Specific Location of Placement</label>
      </h3>
      <textarea
        id="conc-cyl-placementLocation"
        rows={3}
        className="input-field"
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
