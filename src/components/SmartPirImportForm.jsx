import { useState } from 'react'
import { importSmartPir } from '../services/api'

export const IMPORT_PROMPT = "A Smart PIR file (.json) adds its flags with their non-assessable areas, features, curb "
  + "segments and title blocks to the PIR's pages. Nothing already drawn changes; each page in the file takes its "
  + 'scale and rotation from it. Items that fail a check are dropped and listed.'
export const PIR_ID_HINT = "A PIR id is a UUID, such as 3f2b6c1e-8a4d-4f0e-9b7a-1c2d3e4f5a6b."

// The shape of a PIR id
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// What each kind of item is called, one and many
const KINDS = [
  { key: 'flags', kind: 'flag', one: 'flag', many: 'flags' },
  { key: 'non_assessable_areas', kind: 'non_assessable_area', one: 'non-assessable area', many: 'non-assessable areas' },
  { key: 'features', kind: 'feature', one: 'feature', many: 'features' },
  { key: 'segments', kind: 'segment', one: 'curb segment', many: 'curb segments' },
  { key: 'annotations', kind: 'annotations', one: 'title block', many: 'title blocks' },
]

const counted = (count, { one, many }) => `${count} ${count === 1 ? one : many}`

/** How many items a count object ({flags, non_assessable_areas, ...}) holds in all. */
export const totalOf = (counts) => KINDS.reduce((sum, { key }) => sum + (counts?.[key] ?? 0), 0)

/** "5 flags, 2 non-assessable areas and 1 title block": the kinds with a count, or "nothing". */
export function countsText(counts) {
  const parts = KINDS.filter(({ key }) => (counts?.[key] ?? 0) > 0).map(entry => counted(counts[entry.key], entry))
  if (parts.length === 0) return 'nothing'
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * Where a dropped item was in the file, counting from 1: "Page 1, flag 2", "Page 1, flag 1, non-assessable area 3",
 * "Page 2, title block", "The file's title block".
 */
export function droppedPlace({ kind, page_number: pageNumber, index, flag_index: flagIndex }) {
  const name = KINDS.find(entry => entry.kind === kind)?.one ?? kind
  const parts = [pageNumber != null ? `Page ${pageNumber}` : null]
  if (kind === 'non_assessable_area' && flagIndex != null) parts.push(`flag ${flagIndex + 1}`)
  parts.push(index != null ? `${name} ${index + 1}` : name)
  const place = parts.filter(Boolean).join(', ')
  return pageNumber == null && index == null ? `The file's ${name}` : place.charAt(0).toUpperCase() + place.slice(1)
}

// A picked file's text (FileReader, which every browser and the test DOM have)
const readText = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the file."))
  reader.readAsText(file)
})

/**
 * The Smart PIR import, for the admin's /admin/import-smart-pirs: a PIR id (a UUID, checked here) and a Smart PIR
 * .json file, read and parsed in the browser (a file that isn't JSON is refused here, and nothing is sent), then
 * posted to that PIR's import. A refusal (the backend's 404 for an unknown PIR, 422 for a file that isn't a Smart
 * PIR import, 400 for another PIR's file, ...) shows inline as worded, and the id and file stay. After an import it
 * shows what went in, how many pages took their scale, rotation or title block, and every item dropped with where
 * it was and why, with "Import another file" to start again.
 * No props.
 */
export default function SmartPirImportForm() {
  const [pirId, setPirId] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [formKey, setFormKey] = useState(0) // bump to empty the file input (a file input can't be cleared otherwise)

  const id = pirId.trim()
  const badId = id !== '' && !UUID.test(id)
  const ready = Boolean(file) && UUID.test(id) && !busy

  const pick = (e) => {
    setFile(e.target.files?.[0] ?? null)
    setError(null)
  }

  const run = async (e) => {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(null)
    let parsed
    try {
      parsed = JSON.parse(await readText(file))
    } catch (err) {
      setError(`This file isn't valid JSON: ${err.message}`)
      setBusy(false)
      return
    }
    try {
      setResult({ pirId: id, ...(await importSmartPir(id, parsed)) })
    } catch (err) {
      setError(`Couldn't import the file: ${err.message}`)
    }
    setBusy(false)
  }

  const again = () => {
    setResult(null)
    setFile(null)
    setPirId('')
    setFormKey(k => k + 1)
  }

  if (result) {
    const droppedCount = totalOf(result.dropped)
    const items = result.dropped_items ?? []
    return (
      <div className="space-y-4 text-sm">
        <p role="status" className="rounded-md bg-green-50 border border-green-200 text-green-800 px-3 py-2">
          Imported {countsText(result.inserted)} into PIR {result.pirId}.
          {result.pages_updated > 0 && ` Set the scale, rotation or title block of ${result.pages_updated} page${result.pages_updated === 1 ? '' : 's'}.`}
        </p>
        {droppedCount === 0 && items.length === 0 ? (
          <p className="text-gray-600">Nothing was dropped.</p>
        ) : (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="font-medium text-amber-800">Dropped {countsText(result.dropped)}.</p>
            {items.length > 0 && (
              <ul aria-label="Dropped items" className="mt-2 space-y-1 text-amber-900">
                {items.map((item, index) => (
                  <li key={index}>
                    <span className="font-medium">{droppedPlace(item)}:</span> {item.reason}
                  </li>
                ))}
              </ul>
            )}
            {droppedCount > items.length && (
              <p className="mt-2 text-amber-800">
                The rest were lost to a change made to the pages while importing.
              </p>
            )}
          </div>
        )}
        <button type="button" onClick={again} className="btn-primary">Import another file</button>
      </div>
    )
  }

  return (
    <form key={formKey} onSubmit={run} noValidate className="space-y-4">
      <p className="text-sm text-gray-700">{IMPORT_PROMPT}</p>
      <div>
        <label htmlFor="smart-pir-id" className="input-label">PIR id</label>
        <input
          id="smart-pir-id"
          type="text"
          className="input-field font-mono"
          value={pirId}
          disabled={busy}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={badId}
          aria-describedby={badId ? 'smart-pir-id-hint' : undefined}
          onChange={(e) => { setPirId(e.target.value); setError(null) }}
        />
        {badId && <p id="smart-pir-id-hint" className="text-sm text-red-600 mt-1">{PIR_ID_HINT}</p>}
      </div>
      <div>
        <label htmlFor="smart-pir-file" className="input-label">Smart PIR file (.json)</label>
        <input
          id="smart-pir-file"
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={pick}
          className="block w-full text-sm text-gray-700"
        />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={!ready} className="btn-primary">{busy ? 'Importing...' : 'Import'}</button>
    </form>
  )
}
