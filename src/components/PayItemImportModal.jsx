import { useState } from 'react'
import { previewPayItemImport, commitPayItemImport } from '../services/api'
import { formatPayItemQuantity, formatUnitPrice } from '../lib/payItemFormat'
import Modal from './Modal'

// The largest file the backend takes
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024

export const FILE_TOO_LARGE = 'That file is larger than 2 MB.'
export const FILE_CHANGED = 'The file changed since the preview. Re-upload to try again.'

// The fields an overwrite can change (its ref and budget code are what matched), and how each one reads
const DIFF_FIELDS = [
  { key: 'description', label: 'Description' },
  { key: 'unit', label: 'Unit' },
  { key: 'quantity', label: 'Quantity', format: formatPayItemQuantity },
  { key: 'unit_price', label: 'Unit price', format: formatUnitPrice },
  { key: 'spec_section', label: 'Spec section' },
]

const counted = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

// What an overwrite would change: [{label, from, to}], empty when the row matches the item as it is
export function overwriteChanges({ existing, incoming }) {
  const shown = (value, format) => (value === null || value === undefined || value === '' ? '—' : format ? format(value) : value)
  return DIFF_FIELDS
    .filter(({ key }) => (existing[key] ?? null) !== (incoming[key] ?? null))
    .map(({ key, label, format }) => ({ label, from: shown(existing[key], format), to: shown(incoming[key], format) }))
}

// One of the preview's lists, folded away until asked for
function PreviewSection({ title, open = false, children }) {
  return (
    <details open={open} className="border border-gray-200 rounded-md">
      <summary className="px-3 py-2 text-sm font-medium text-gray-900 cursor-pointer">{title}</summary>
      <ul className="max-h-56 overflow-y-auto divide-y divide-gray-100 border-t border-gray-200 text-sm">
        {children}
      </ul>
    </details>
  )
}

/**
 * Lets an admin import a project's pay items from a CSV, in two screens. Upload: pick a file (at most 2 MB) and
 * ask for a preview. Preview: how many rows are new, overwrites and errors, with each list to look through (an
 * overwrite shows what it would change); Confirm import is off while any row has an error or the file has no
 * rows, Back returns to the upload screen. It runs both calls itself, sending the same file twice. A refused
 * preview shows the backend's reason on the upload screen; a refused import (the file no longer passes) goes back
 * there to upload again.
 * Props: projectId, onClose, onImported(result) (called with {inserted, updated} before onClose).
 */
export default function PayItemImportModal({ projectId, onClose, onImported }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null) // the backend's preview of the file; the preview screen shows while set
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const pick = (picked) => {
    const tooLarge = Boolean(picked) && picked.size > MAX_IMPORT_BYTES
    setFile(tooLarge ? null : picked ?? null)
    setError(tooLarge ? FILE_TOO_LARGE : null)
  }

  // Back to the upload screen with nothing picked: a file input can't be given its file back
  const startOver = (reason = null) => {
    setPreview(null)
    setFile(null)
    setError(reason)
  }

  const runPreview = async (e) => {
    e.preventDefault()
    if (busy || !file) return
    setBusy(true)
    setError(null)
    try {
      setPreview(await previewPayItemImport(projectId, file))
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  const runImport = async () => {
    setBusy(true)
    setError(null)
    let result
    try {
      result = await commitPayItemImport(projectId, file)
    } catch (err) {
      // A 400 here means the file no longer reads as it did for the preview
      if (err.status === 400) startOver(FILE_CHANGED)
      else setError(err.message)
      setBusy(false)
      return
    }
    onImported?.(result)
    onClose()
  }

  const cancel = <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">Cancel</button>

  if (!preview) {
    return (
      <Modal
        title="Import Pay Items"
        onClose={onClose}
        busy={busy}
        footer={
          <>
            {cancel}
            <button type="submit" form="pay-item-import-form" disabled={busy || !file} className="btn-primary">
              {busy ? 'Reading...' : 'Preview'}
            </button>
          </>
        }
      >
        <form id="pay-item-import-form" onSubmit={runPreview} noValidate>
          <label htmlFor="pay-item-import-file" className="input-label">CSV file</label>
          <input
            id="pay-item-import-file"
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            aria-describedby="pay-item-import-help"
            onChange={(e) => pick(e.target.files?.[0])}
            className="block w-full text-sm text-gray-700 file:mr-3 file:px-3 file:py-2 file:rounded-md file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
          <p id="pay-item-import-help" className="text-sm text-gray-500 mt-2">
            Required columns: pay_item_ref, description, quantity, unit, unit_price, budget_code. Optional:
            spec_section. First row is headers (case-insensitive). Max 2 MB.
          </p>
          {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
        </form>
      </Modal>
    )
  }

  const { new_count: newCount, overwrite_count: overwriteCount, error_count: errorCount } = preview
  const importable = newCount + overwriteCount
  const blocked = errorCount > 0 || importable === 0

  return (
    <Modal
      title="Import Pay Items"
      onClose={onClose}
      busy={busy}
      size="lg"
      footer={
        <>
          <button type="button" onClick={() => startOver()} disabled={busy} className="btn-secondary">Back</button>
          {cancel}
          <button type="button" onClick={runImport} disabled={busy || blocked} className="btn-primary">
            {busy ? 'Importing...' : 'Confirm import'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p aria-label="Preview counts" className="text-lg font-semibold">
          <span className="text-green-700">{newCount} new</span>
          <span className="text-gray-300"> | </span>
          <span className="text-blue-700">{counted(overwriteCount, 'overwrite')}</span>
          <span className="text-gray-300"> | </span>
          <span className="text-red-700">{counted(errorCount, 'error')}</span>
        </p>

        {errorCount > 0 ? (
          <p role="alert" className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md px-4 py-3">
            This CSV has {counted(errorCount, 'error')} and can't be imported. Fix them and re-upload.
          </p>
        ) : importable === 0 ? (
          <p role="alert" className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-md px-4 py-3">
            This CSV has no pay items to import.
          </p>
        ) : (
          <p role="status" className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-md px-4 py-3">
            Ready to import {counted(importable, 'pay item')}.
          </p>
        )}

        {preview.ignored_columns.length > 0 && (
          <p className="text-sm text-gray-500">
            Ignored {preview.ignored_columns.length === 1 ? 'column' : 'columns'}: {preview.ignored_columns.join(', ')}.
          </p>
        )}

        {errorCount > 0 && (
          <PreviewSection title={`Errors (${errorCount})`} open>
            {preview.errors.map(({ row, reason, raw }) => (
              <li key={row} className="px-3 py-2">
                <p className="text-red-700"><span className="font-medium">Row {row}:</span> {reason}</p>
                <p className="text-gray-500 break-words">
                  {Object.entries(raw).filter(([, cell]) => cell !== '').map(([column, cell]) => `${column}: ${cell}`).join(' · ')
                    || 'The row is empty.'}
                </p>
              </li>
            ))}
          </PreviewSection>
        )}

        <PreviewSection title={`New (${newCount})`}>
          {preview.new.map(item => (
            <li key={item.row} className="px-3 py-2">
              <p className="font-medium text-gray-900">{item.pay_item_ref} @ {item.budget_code}</p>
              <p className="text-gray-600">
                {item.description} — {formatPayItemQuantity(item.quantity)} {item.unit} at {formatUnitPrice(item.unit_price)}
              </p>
            </li>
          ))}
        </PreviewSection>

        <PreviewSection title={`Overwrites (${overwriteCount})`}>
          {preview.overwrites.map(overwrite => {
            const changes = overwriteChanges(overwrite)
            return (
              <li key={overwrite.row} className="px-3 py-2">
                <p className="font-medium text-gray-900">{overwrite.pay_item_ref} @ {overwrite.budget_code}</p>
                {changes.length === 0 ? (
                  <p className="text-gray-500">No changes.</p>
                ) : changes.map(({ label, from, to }) => (
                  <p key={label} className="text-gray-600">{label}: {from} → {to}</p>
                ))}
              </li>
            )
          })}
        </PreviewSection>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
