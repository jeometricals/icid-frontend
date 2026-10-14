import { softDeletePir, undeletePir } from '../services/api'

// What a demo user reads on a site's page and its PIR's: the backend keeps them read-only on both
export const PIR_DEMO_NOTE = 'Demo mode: sites and PIRs are read-only.'

// How far a property's PIR has got: none at all, signed by the DOT inspector (every PIR is), or with the
// as-built signed too
export const PIR_STATUS = {
  none: { label: '—' },
  dotSigned: { label: 'Signed by DOT' },
  asBuiltSigned: { label: 'As-built signed' },
}

/** The status key of a property's live PIR (null or undefined when it has none). */
export function pirStatus(pir) {
  if (!pir) return 'none'
  return pir.as_built_signed_at ? 'asBuiltSigned' : 'dotSigned'
}

// The property list's pir_status, as the backend spells it, against the keys above
const API_PIR_STATUS = { none: 'none', dot_signed: 'dotSigned', as_built_signed: 'asBuiltSigned' }

/** The status key for a property list row's pir_status; a missing or unknown one reads as none. */
export function pirStatusFromApi(value) {
  return API_PIR_STATUS[value] ?? 'none'
}

// A PIR's two confirmed actions: the call, the words of the dialog and of the toast once it went through
export const PIR_ACTIONS = {
  delete: {
    run: pir => softDeletePir(pir.id),
    title: () => 'Delete this PIR?',
    message: pir => `The PIR signed by ${pir.inspector_initials} is kept but no longer counts, and the site can take a new one.`,
    confirmLabel: 'Delete',
    confirmClassName: 'btn-danger',
    done: () => 'PIR deleted.',
  },
  undelete: {
    run: pir => undeletePir(pir.id),
    title: () => 'Un-delete this PIR?',
    message: pir => `The PIR signed by ${pir.inspector_initials} becomes the site's PIR again.`,
    confirmLabel: 'Un-delete',
    confirmClassName: 'btn-primary',
    done: () => 'PIR restored.',
  },
}
