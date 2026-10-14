import { softDeleteFlag, undeleteFlag } from '../services/api'

// A flag's two confirmed actions: the call, the words of the dialog and of the toast once it went through
export const FLAG_ACTIONS = {
  delete: {
    run: flag => softDeleteFlag(flag.id),
    title: flag => `Delete flag #${flag.display_order}?`,
    message: () => 'It is kept but no longer counts toward the PIR. It can be un-deleted later.',
    confirmLabel: 'Delete',
    confirmClassName: 'btn-danger',
    done: flag => `Flag #${flag.display_order} deleted.`,
  },
  undelete: {
    run: flag => undeleteFlag(flag.id),
    title: flag => `Un-delete flag #${flag.display_order}?`,
    message: () => 'It counts toward the PIR again.',
    confirmLabel: 'Un-delete',
    confirmClassName: 'btn-primary',
    done: flag => `Flag #${flag.display_order} restored.`,
  },
}

/** The display order a new flag starts with: one past the highest of the PIR's flags, or 1 for its first. */
export function nextDisplayOrder(flags) {
  return flags.length === 0 ? 1 : Math.max(...flags.map(flag => flag.display_order)) + 1
}
