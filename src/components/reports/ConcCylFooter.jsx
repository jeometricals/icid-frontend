/**
 * The instruction lines printed at the foot of the DDC "Data Sheet for Concrete Test Cylinders", as a note card.
 * Static: no props. Signatures are not shown here (the IDR page's banner and the export carry them).
 */
const INSTRUCTIONS = [
  'Resident Engineer or Inspector to complete columns 1, 2, 3.',
  'This data sheet must accompany all cylinders made this day.',
  'Cylinders will not be transported to the lab without this form',
]

export default function ConcCylFooter() {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
        {INSTRUCTIONS.map(line => <li key={line}>{line}</li>)}
      </ul>
    </div>
  )
}
