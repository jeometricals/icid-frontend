/**
 * A dropdown for adding an extra row to a report section (a trade, a piece of equipment). Picking an option calls
 * onPick(label) right away; picking "Other (specify)" reveals a label input and an Add button instead.
 * Props: options (strings), usedLabels (hidden from the list, except "Other (specify)"), onPick(label), placeholder, disabled.
 */
import { useState } from 'react'

export const OTHER_OPTION = 'Other (specify)'

export default function AddRowPicker({ options, usedLabels = [], onPick, placeholder, disabled = false }) {
  const [specifying, setSpecifying] = useState(false)
  const [otherLabel, setOtherLabel] = useState('')

  const available = options.filter(option => option === OTHER_OPTION || !usedLabels.includes(option))

  const handleSelect = (e) => {
    const option = e.target.value
    if (option === OTHER_OPTION) {
      setSpecifying(true)
      return
    }
    setSpecifying(false)
    setOtherLabel('')
    if (option) onPick(option)
  }

  const addOther = () => {
    const label = otherLabel.trim()
    if (!label) return
    onPick(label)
    setSpecifying(false)
    setOtherLabel('')
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      <select
        className="input-field w-auto"
        aria-label={placeholder}
        value={specifying ? OTHER_OPTION : ''}
        onChange={handleSelect}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {available.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {specifying && (
        <>
          <input
            type="text"
            className="input-field w-auto flex-1"
            placeholder="Specify"
            value={otherLabel}
            onChange={(e) => setOtherLabel(e.target.value)}
            disabled={disabled}
          />
          <button type="button" onClick={addOther} disabled={disabled || !otherLabel.trim()} className="btn-secondary text-sm">
            Add
          </button>
        </>
      )}
    </div>
  )
}
