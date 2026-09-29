/**
 * The "Workforce and Equipment" card: WorkforceSection and EquipmentSection side by side, wired to useReportForm.
 * Props: form (the object useReportForm returns; reads formData, isReadOnly and the workforce / equipment handlers).
 */
import WorkforceSection from './WorkforceSection'
import EquipmentSection from './EquipmentSection'

export default function WorkforceEquipmentCard({ form }) {
  const { formData, isReadOnly } = form
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">Workforce and Equipment</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WorkforceSection
          workforce={formData.workforce}
          onChange={(role, value) => form.handleNestedInputChange('workforce', role, value)}
          additionalWorkforce={formData.additionalWorkforce}
          onAddTrade={form.handleAddTrade}
          onChangeAdditional={form.handleChangeAdditionalWorkforce}
          onRemoveAdditional={form.handleRemoveAdditionalWorkforce}
          disabled={isReadOnly}
        />
        <EquipmentSection
          equipment={formData.equipment}
          onChange={(key, updated) => form.handleNestedInputChange('equipment', key, updated)}
          additionalEquipment={formData.additionalEquipment}
          onAddEquipment={form.handleAddEquipment}
          onChangeAdditional={form.handleChangeAdditionalEquipment}
          onRemoveAdditional={form.handleRemoveAdditionalEquipment}
          disabled={isReadOnly}
        />
      </div>
    </div>
  )
}
