/**
 * The "Equipment" half of a report's workforce/equipment card: model/size and count inputs for Front End Loader,
 * Backhoe, Truck (Dump), Compressor and Excavator. Stateless. Props: equipment ({ [key]: { model, number } }), onChange(key, updatedEntry) with the whole
 * updated { model, number } entry, disabled (makes the inputs natively disabled).
 */
export default function EquipmentSection({ equipment, onChange, disabled = false }) {
  return (
    <div>
      <h4 className="text-md font-semibold text-gray-900 mb-3">Equipment</h4>
      <div className="space-y-3">
        {[
          { label: 'Front End Loader', key: 'frontEndLoader' },
          { label: 'Backhoe', key: 'backhoe' },
          { label: 'Truck (Dump)', key: 'truckDump' },
          { label: 'Compressor', key: 'compressor' },
          { label: 'Excavator', key: 'excavator' }
        ].map((equip) => (
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
      </div>
    </div>
  )
}
