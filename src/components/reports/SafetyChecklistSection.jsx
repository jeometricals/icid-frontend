/**
 * The "End of the Day MPT/Safety Check List" card: Y / N / N/A radios and a Remarks input per safety item. Stateless.
 * Props: safetyChecks ({ [key]: 'Y' | 'N' | 'NA' | null }), onChange(key, value) with 'Y', 'N' or 'NA',
 * remarks ({ [key]: string }), onRemarksChange(key, value), disabled (makes the inputs natively disabled).
 */
export default function SafetyChecklistSection({ safetyChecks, onChange, remarks, onRemarksChange, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">End of the Day MPT/Safety Check List</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/2">Item</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Y</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">N</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">N/A</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remarks</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {[
              { label: 'Plastic Barrels', key: 'plasticBarrels' },
              { label: 'Pedestrian Barricades', key: 'pedestrianBarricades' },
              { label: 'Timber Curbs', key: 'timberCurbs' },
              { label: 'Timber/Breakaway Barricades', key: 'timberBreakawayBarricades' },
              { label: 'General Safety Conditions', key: 'generalSafety' },
              { label: 'Local Emergency Access', key: 'localEmergencyAccess' },
              { label: 'Fencing', key: 'fencing' },
              { label: 'Plates', key: 'plates' },
              { label: 'Arrow Board', key: 'arrowBoard' },
              { label: 'Site Cleaned and Secured', key: 'siteCleaned' }
            ].map((item) => (
              <tr key={item.key}>
                <td className="px-4 py-3 text-sm text-gray-900">{item.label}</td>
                {['Y', 'N', 'NA'].map((option) => (
                  <td key={option} className="px-4 py-3 text-center">
                    <input
                      type="radio"
                      name={item.key}
                      checked={safetyChecks[item.key] === option}
                      disabled={disabled}
                      onChange={() => onChange(item.key, option)}
                      className="h-4 w-4 text-construction-600 focus:ring-construction-500"
                    />
                  </td>
                ))}
                <td className="px-4 py-3">
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Remarks"
                    value={remarks[item.key] || ''}
                    disabled={disabled}
                    onChange={(e) => onRemarksChange(item.key, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
