/**
 * The Asphaltic Concrete "Pavement Course Table" card: an Add Course button and one editable row per course placed
 * (item, mix, stations, lane, dimensions, course, design depth, area, weight), each removable. Stateless.
 * Props: courses (array of course rows), onAddCourse(), onCourseChange(index, field, value), onRemoveCourse(index),
 * disabled (makes the button and inputs natively disabled).
 */
import RemoveRowButton from './RemoveRowButton'

const FIELDS = [
  { label: 'Item No.', key: 'itemNo', type: 'text' },
  { label: 'Mix Type', key: 'mixType', type: 'text' },
  { label: 'Station From', key: 'stationFrom', type: 'text' },
  { label: 'Station To', key: 'stationTo', type: 'text' },
  { label: 'Lane', key: 'lane', type: 'text' },
  { label: 'Length', key: 'length', type: 'number' },
  { label: 'Width', key: 'width', type: 'number' },
  { label: 'Course', key: 'course', type: 'text' },
  { label: 'Design Depth', key: 'designDepth', type: 'number' },
  { label: 'Area (S.Y.)', key: 'area', type: 'number' },
  { label: 'Weight (Tons)', key: 'weight', type: 'number' },
]

const HEADER_CLASS = 'px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap'

export default function ACPavementCourseTable({ courses, onAddCourse, onCourseChange, onRemoveCourse, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="form-section-title mb-0">Pavement Course Table</h3>
        <button type="button" onClick={onAddCourse} disabled={disabled} className="btn-secondary text-sm">
          Add Course
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {FIELDS.map(field => <th key={field.key} className={HEADER_CLASS}>{field.label}</th>)}
              <th className="px-3 py-3"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {courses.length === 0 ? (
              <tr>
                <td colSpan="12" className="px-4 py-8 text-center text-gray-500">
                  No courses added yet. Click Add Course to record one.
                </td>
              </tr>
            ) : (
              courses.map((course, index) => (
                <tr key={index}>
                  {FIELDS.map(field => (
                    <td key={field.key} className="px-3 py-2">
                      <input
                        type={field.type}
                        step={field.type === 'number' ? '0.01' : undefined}
                        className="input-field min-w-[6rem]"
                        aria-label={`Course ${index + 1} ${field.label}`}
                        value={course[field.key] ?? ''}
                        disabled={disabled}
                        onChange={(e) => onCourseChange(index, field.key, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <RemoveRowButton
                      onClick={() => onRemoveCourse(index)}
                      disabled={disabled}
                      ariaLabel={`Remove course ${index + 1}`}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
