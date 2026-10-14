import { softDeleteProperty, undeleteProperty } from '../services/api'

// A property's two confirmed actions, on its project's list and on its own page: the call, the words of the
// dialog and of the toast once it went through
export const PROPERTY_ACTIONS = {
  delete: {
    run: row => softDeleteProperty(row.id),
    title: row => `Delete property ${row.bbl}?`,
    message: row => `${row.address} leaves this project's list and its BBL is freed. It can be un-deleted later.`,
    confirmLabel: 'Delete',
    confirmClassName: 'btn-danger',
    done: row => `Property ${row.bbl} deleted.`,
  },
  undelete: {
    run: row => undeleteProperty(row.id),
    title: row => `Un-delete property ${row.bbl}?`,
    message: row => `${row.address} returns to this project's list with BBL ${row.bbl}.`,
    confirmLabel: 'Un-delete',
    confirmClassName: 'btn-primary',
    done: row => `Property ${row.bbl} restored.`,
  },
}
