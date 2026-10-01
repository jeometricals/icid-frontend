/**
 * The "Equipment" half of a report's workforce/equipment card: model/size and count inputs for the standard equipment
 * (by default Front End Loader, Backhoe, Truck (Dump), Compressor and Excavator), then any added equipment (each
 * removable) and an "Add equipment" picker. Stateless. Props: equipment ({ [key]: { model, number } }),
 * onChange(key, updatedEntry), additionalEquipment ([{ label, model, number }]), onAddEquipment(label),
 * onChangeAdditional(index, field, value), onRemoveAdditional(index), disabled (makes the inputs natively disabled),
 * standardEquipment ([{ label, key }]) and extras (the picker's options) for a report whose form lists different ones.
 */
import AddRowPicker, { OTHER_OPTION } from './AddRowPicker'
import RemoveRowButton from './RemoveRowButton'

export const STANDARD_EQUIPMENT = [
  { label: 'Front End Loader', key: 'frontEndLoader' },
  { label: 'Backhoe', key: 'backhoe' },
  { label: 'Truck (Dump)', key: 'truckDump' },
  { label: 'Compressor', key: 'compressor' },
  { label: 'Excavator', key: 'excavator' },
]

export const EQUIPMENT_EXTRAS = [
  'Crane', 'Paving Machine', 'AC Distributor', 'Sweepers', 'Trailers',
  'Roller – Static', 'Roller – Dynamic', 'Hand Tamper', 'Pavement Cutter', OTHER_OPTION,
]

export default function EquipmentSection({
  equipment,
  onChange,
  additionalEquipment,
  onAddEquipment,
  onChangeAdditional,
  onRemoveAdditional,
  disabled = false,
  standardEquipment = STANDARD_EQUIPMENT,
  extras = EQUIPMENT_EXTRAS,
}) {
  return (
    <div>
      <h4 className="text-md font-semibold text-gray-900 mb-3">Equipment</h4>
      <div className="space-y-3">
        {standardEquipment.map((equip) => (
          <div key={equip.key} className="grid grid-cols-3 gap-2">
            <div className="flex items-center px-3 py-2 bg-gray-50 rounded">
              <span className="text-sm font-medium text-gray-700">{equip.label}</span>
            </div>
            <input
              type="text"
              className="input-field"
              placeholder="Model/Size"
              value={equipment[equip.key].model}
              disabled={disabled}
              onChange={(e) => onChange(equip.key, { ...equipment[equip.key], model: e.target.value })}
            />
            <input
              type="number"
              className="input-field"
              placeholder="No."
              value={equipment[equip.key].number}
              disabled={disabled}
              onChange={(e) => onChange(equip.key, { ...equipment[equip.key], number: e.target.value })}
            />
          </div>
        ))}
        {additionalEquipment.map((row, index) => (
          <div key={index} className="grid grid-cols-3 gap-2">
            <div className="flex items-center px-3 py-2 bg-gray-50 rounded">
              <span className="text-sm font-medium text-gray-700">{row.label}</span>
            </div>
            <input
              type="text"
              className="input-field"
              placeholder="Model/Size"
              value={row.model}
              disabled={disabled}
              onChange={(e) => onChangeAdditional(index, 'model', e.target.value)}
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="input-field"
                placeholder="No."
                value={row.number}
                disabled={disabled}
                onChange={(e) => onChangeAdditional(index, 'number', e.target.value)}
              />
              <RemoveRowButton onClick={() => onRemoveAdditional(index)} disabled={disabled} ariaLabel={`Remove ${row.label}`} />
            </div>
          </div>
        ))}
      </div>
      <AddRowPicker
        options={extras}
        usedLabels={additionalEquipment.map(r => r.label)}
        onPick={onAddEquipment}
        placeholder="Add equipment"
        disabled={disabled}
      />
    </div>
  )
}
