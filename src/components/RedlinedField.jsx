import { useId, useState } from 'react'
import { Pencil } from 'lucide-react'
import { useRedline } from '../contexts/RedlineContext'
import { REDLINE_TEXT, REVISED_AFTER_RETURN, displayValue, editsForField, revisedAfterReturn } from '../lib/fieldEdits'

/**
 * One field of an IDR with its reviewer edits drawn as a redline: the original value struck through, then each
 * edit's value in blue with its editor's initials, oldest first; and "Inspector revised after return" when the value
 * has changed since the last edit. In edit mode, for the stage's reviewer, a pencil opens an inline input with
 * Save / Cancel.
 * It wraps the field's normal control (children): with no edits and no edit mode that control is all it renders,
 * and outside a RedlineProvider it renders nothing else at all. On a draft the control stays live and the history
 * reads under it.
 * Props: path (the field_path), value (the field's current value), label (names the field for screen readers and the
 * pencil), type ('text' | 'number' | 'time' | 'date' | 'textarea' | 'select'; default 'text'), options (for 'select':
 * [{value, label}]), format(value) (how a value reads, e.g. a time without its seconds; default as it is),
 * toRequest(text) (the input's text as the value to send; default the text itself), children.
 */
export default function RedlinedField({
  path, value, label, type = 'text', options = [], format = v => v, toRequest = text => text, children = null,
}) {
  const redline = useRedline()
  const inputId = useId()
  const [draft, setDraft] = useState(null) // the inline input's text while editing; null when not
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  if (!redline) return children

  const chain = editsForField(redline.edits, redline.reportId, path)
  const history = chain.length > 0 && (
    <RedlineStack chain={chain} format={format} revised={revisedAfterReturn(value, chain, format)} current={value} />
  )

  // A draft's own inputs are live; its history from an earlier review only reads beside them
  if (redline.isDraft) {
    return history ? <div>{children}<div className="mt-1">{history}</div></div> : children
  }

  const startEditing = () => {
    // A select opens on the stored value (what its options hold); any other input on the value as it reads
    const current = type === 'select' ? value : format(value)
    setDraft(current === null || current === undefined ? '' : String(current))
    setError(null)
  }

  const save = async (e) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    const result = await redline.saveField(path, toRequest(draft))
    setSaving(false)
    if (result.ok || result.conflict) setDraft(null) // on a conflict the page has reloaded: start again from there
    else setError(result.message)
  }

  if (draft !== null) {
    const shared = {
      id: inputId, value: draft, disabled: saving, autoFocus: true, 'aria-label': `New value for ${label}`,
      onChange: (e) => setDraft(e.target.value),
    }
    return (
      <form onSubmit={save} className="space-y-2">
        {type === 'textarea' ? (
          <textarea {...shared} className="input-field min-h-[120px]" />
        ) : type === 'select' ? (
          <select {...shared} className="input-field">
            <option value="">(blank)</option>
            {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        ) : (
          <input {...shared} type={type} step={type === 'number' ? 'any' : undefined} className="input-field" />
        )}
        <div className="flex items-center gap-2">
          <button type="submit" disabled={saving} className="btn-primary text-sm py-1">{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" disabled={saving} onClick={() => setDraft(null)} className="btn-secondary text-sm py-1">
            Cancel
          </button>
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </form>
    )
  }

  return (
    <div className="group flex items-start gap-2">
      <div className="flex-1 min-w-0">{history || children}</div>
      {redline.canEdit && (
        <button
          type="button"
          onClick={startEditing}
          aria-label={`Edit ${label}`}
          className="mt-1 text-gray-400 hover:text-construction-700 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

/**
 * A field's history as a redline: the original struck through, then each edit in blue with its editor's initials.
 * Props: chain (the field's edits, oldest first; not empty), format(value), revised (the value changed after the
 * last edit), current (the field's value now, shown when revised).
 */
export function RedlineStack({ chain, format = v => v, revised = false, current }) {
  return (
    <div className="text-sm space-y-0.5" data-testid="redline">
      <div className="line-through text-gray-500 whitespace-pre-wrap">{displayValue(format(chain[0].old_value))}</div>
      {chain.map(edit => (
        <div key={edit.edit_id} className={`${REDLINE_TEXT} font-medium whitespace-pre-wrap`}>
          {displayValue(format(edit.new_value))}
          <InitialsBadge initials={edit.editor_initials} name={edit.editor_name} />
        </div>
      ))}
      {revised && (
        <div className="text-gray-900 whitespace-pre-wrap">
          {displayValue(format(current))}
          <span className="ml-2 text-[11px] text-gray-500">{REVISED_AFTER_RETURN}</span>
        </div>
      )}
    </div>
  )
}

/**
 * A reviewer's initials beside their edit or approval. Props: initials, name (the tooltip), stale (greyed and
 * struck, with staleNote as the tooltip: an approval that no longer counts).
 */
export function InitialsBadge({ initials, name, stale = false, staleNote }) {
  if (!initials) return null
  return (
    <span
      title={(stale ? staleNote : name) || undefined}
      data-stale={stale || undefined}
      className={`ml-2 inline-block rounded bg-gray-100 px-1 text-[11px] font-normal align-middle ${stale
        ? 'text-gray-400 line-through opacity-60' : 'text-gray-500'}`}
    >
      {initials}
    </span>
  )
}
