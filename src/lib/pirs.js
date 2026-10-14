import { softDeletePir, undeletePir } from '../services/api'

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

// A PIR's two confirmed actions: the call, the words of the dialog and of the toast once it went through
export const PIR_ACTIONS = {
  delete: {
    run: pir => softDeletePir(pir.id),
    title: () => 'Delete this PIR?',
    message: pir => `The PIR signed by ${pir.inspector_initials} is kept but no longer counts, and the property can take a new one.`,
    confirmLabel: 'Delete',
    confirmClassName: 'btn-danger',
    done: () => 'PIR deleted.',
  },
  undelete: {
    run: pir => undeletePir(pir.id),
    title: () => 'Un-delete this PIR?',
    message: pir => `The PIR signed by ${pir.inspector_initials} becomes the property's PIR again.`,
    confirmLabel: 'Un-delete',
    confirmClassName: 'btn-primary',
    done: () => 'PIR restored.',
  },
}
