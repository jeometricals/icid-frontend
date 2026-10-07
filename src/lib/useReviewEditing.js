/**
 * Reviewer editing for one IDR, shared by the IDR page and the report pages: whether the signed-in user may edit it
 * (they are the reviewer who accepted it at its current stage, or an admin), whether edit mode is on, the four
 * edit calls and the pay-item approval. Each call hands the updated IDR to onIdrUpdated; when the field changed under the reviewer (409) it
 * shows "Someone else edited this field — reloading" and refetches instead.
 * Takes { idr (with status and the reviewer columns; null while loading), onIdrUpdated(idr), refetch() }.
 * Returns { mayEdit, editMode, toggleEditMode, toast, clearToast, saveField(reportId, fieldPath, newValue),
 * revise(itemId, quantity), addItem(reportId, item), addTruck(reportId, truck), approve(itemId), attesting }; the
 * five calls resolve to
 * {ok: true}, {ok: false, message} or {ok: false, conflict: true}. attesting is who is attesting to pay items here
 * ({userUuid, stage, acceptedAt}, as isPayItemTouched takes it), or null for someone who may not.
 */
import { useState } from 'react'
import { useOptionalAuth } from '../contexts/AuthContext'
import { useProjectRoles } from '../contexts/ProjectRolesContext'
import { useEditMode } from '../contexts/RedlineContext'
import { addPayItem, addTruck, approvePayItem, editIdrField, revisePayItem } from '../services/api'
import { EDIT_CONFLICT, reviewStage, stageAcceptedTimes } from './fieldEdits'
import { canEditInReview } from './reviewRoles'

export default function useReviewEditing({ idr, onIdrUpdated, refetch }) {
  const user = useOptionalAuth()?.user ?? null
  const { rolesByProject } = useProjectRoles()
  const [isOn, toggleEditMode] = useEditMode(idr?.idr_id)
  const [toast, setToast] = useState(null)

  const roles = (idr && rolesByProject?.[idr.project_id]) || []
  const mayEdit = Boolean(idr) && canEditInReview(idr, user, roles)

  const run = async (request) => {
    try {
      onIdrUpdated(await request())
      return { ok: true }
    } catch (err) {
      if (err.status === 409) {
        setToast(EDIT_CONFLICT)
        await refetch()
        return { ok: false, conflict: true }
      }
      return { ok: false, message: err.message }
    }
  }

  return {
    mayEdit,
    editMode: mayEdit && isOn,
    toggleEditMode,
    toast,
    clearToast: () => setToast(null),
    saveField: (reportId, fieldPath, newValue) => run(() => editIdrField(idr.idr_id, { reportId, fieldPath, newValue })),
    revise: (itemId, quantity) => run(() => revisePayItem(idr.idr_id, itemId, quantity)),
    addItem: (reportId, item) => run(() => addPayItem(idr.idr_id, { reportId, ...item })),
    addTruck: (reportId, truck) => run(() => addTruck(idr.idr_id, reportId, truck)),
    approve: (itemId) => run(() => approvePayItem(idr.idr_id, itemId)),
    attesting: mayEdit
      ? { userUuid: user?.uuid, stage: reviewStage(idr.status), acceptedAt: stageAcceptedTimes(idr) }
      : null,
  }
}
