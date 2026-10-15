import { softDeleteProperty, undeleteProperty } from '../services/api'

/**
 * A site's short name, for buttons, dialogs and toasts: a sidewalk's BBL, a ped ramp's display_address (it has no
 * BBL).
 */
export const siteName = (row) => (row.kind === 'ped_ramp' ? row.display_address : row.bbl)

// What a delete frees: a sidewalk's BBL; a ped ramp has nothing unique
const freed = row => (row.kind === 'ped_ramp' ? '' : ' and its BBL is freed')

// A property's two confirmed actions, on its project's list and on its own page: the call, the words of the
// dialog and of the toast once it went through (the words say "site", as the UI does)
export const PROPERTY_ACTIONS = {
  delete: {
    run: row => softDeleteProperty(row.id),
    title: row => `Delete site ${siteName(row)}?`,
    message: row => `${row.display_address} leaves this project's list${freed(row)}. It can be un-deleted later.`,
    confirmLabel: 'Delete',
    confirmClassName: 'btn-danger',
    done: row => `Site ${siteName(row)} deleted.`,
  },
  undelete: {
    run: row => undeleteProperty(row.id),
    title: row => `Un-delete site ${siteName(row)}?`,
    message: row => `${row.display_address} returns to this project's list${row.kind === 'ped_ramp' ? '' : ` with BBL ${row.bbl}`}.`,
    confirmLabel: 'Un-delete',
    confirmClassName: 'btn-primary',
    done: row => `Site ${siteName(row)} restored.`,
  },
}
