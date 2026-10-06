/**
 * Reviewer editing for one IDR, shared by the IDR page and the report pages: whether the signed-in user may edit it
 * (they are the reviewer who accepted it at its current stage, or an admin), whether edit mode is on, and the three
 * edit calls. Each call hands the updated IDR to onIdrUpdated; when the field changed under the reviewer (409) it
 * shows "Someone else edited this field — reloading" and refetches instead.
 * Takes { idr (with status and the reviewer columns; null while loading), onIdrUpdated(idr), refetch() }.
 * Returns { mayEdit, editMode, toggleEditMode, toast, clearToast, saveField(reportId, fieldPath, newValue),
 * revise(itemId, quantity), addItem(reportId, item) }; the three calls resolve to {ok: true},
 * {ok: false, message} or {ok: false, conflict: true}.
 */
import { useState } from 'react'
import { useOptionalAuth } from '../contexts/AuthContext'
import { useProjectRoles } from '../contexts/ProjectRolesContext'
import { useEditMode } from '../contexts/RedlineContext'
import { addPayItem, editIdrField, revisePayItem } from '../services/api'
import { EDIT_CONFLICT } from './fieldEdits'
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
  }
}
