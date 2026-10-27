import { useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ExternalLink, RefreshCw, Upload } from 'lucide-react'
import { getTaxMapPdf, refreshTaxMapPdf, uploadTaxMapPdf } from '../services/api'
import { dofMapUrl } from '../lib/taxMap'

export const NO_PDF = '— · none'

// A date the backend sends ('2013-07-25' or a timestamp) as the page shows it
const day = (value) => (value ? format(parseISO(value), 'yyyy-MM-dd') : null)

/**
 * A sidewalk's DOF tax-map PDF on Site Info (Slice Y1.5), under its tax map frontage: "Brooklyn block 700 · effective
 * 2013-07-25 · View" for DOF's map (View opens DOF's own page of it, which lists the block's inset maps), "Uploaded
 * 2026-11-05 · View" for an admin's upload (View opens the stored copy through a short-lived signed URL), or "— · none".
 * An admin also gets Refresh (fetch the block's current map from DOF now) and Upload (a PDF, when DOF's can't be
 * fetched); each hands the PDF it stored to onChanged, and a refusal shows under the line in the backend's words.
 * Props: property, admin, onChanged({source, map_id, effective_date, fetched_at, uploaded_by, ...}).
 */
export default function TaxMapPdfLine({ property, admin, onChanged }) {
  const [busy, setBusy] = useState(null) // 'refresh' | 'upload' | 'view' while one runs
  const [error, setError] = useState(null)
  const fileInput = useRef(null)

  const fromDof = property.tax_map_pdf_source === 'dof_map_library'
  const dofUrl = fromDof ? dofMapUrl(property.tax_map_pdf_map_id) : null
  const label = !property.has_tax_map_pdf
    ? NO_PDF
    : fromDof
      ? [`${property.boro} block ${property.block}`,
        property.tax_map_pdf_effective_date && `effective ${day(property.tax_map_pdf_effective_date)}`].filter(Boolean).join(' · ')
      : `Uploaded ${day(property.tax_map_pdf_fetched_at)}`

  const run = async (kind, action) => {
    if (busy) return
    setBusy(kind)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  // An upload has no DOF page: open the stored copy through a fresh signed URL
  const viewStored = () => run('view', async () => {
    const pdf = await getTaxMapPdf(property.id)
    window.open(pdf.url, '_blank', 'noopener')
  })

  const upload = (file) => run('upload', async () => {
    if (file.type && file.type !== 'application/pdf') throw new Error('Choose a PDF.')
    onChanged(await uploadTaxMapPdf(property.id, file))
  })

  const button = 'btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs'
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span>{label}</span>
        {property.has_tax_map_pdf && (dofUrl ? (
          <a href={dofUrl} target="_blank" rel="noopener noreferrer" className={button}>
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            <span>View</span>
          </a>
        ) : (
          <button type="button" onClick={viewStored} disabled={Boolean(busy)} className={button}>
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            <span>{busy === 'view' ? 'Opening...' : 'View'}</span>
          </button>
        ))}
        {admin && (
          <>
            <button type="button" onClick={() => run('refresh', async () => onChanged(await refreshTaxMapPdf(property.id)))}
              disabled={Boolean(busy)} className={button}>
              <RefreshCw className={`h-3 w-3${busy === 'refresh' ? ' animate-spin' : ''}`} aria-hidden="true" />
              <span>{busy === 'refresh' ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <button type="button" onClick={() => fileInput.current?.click()} disabled={Boolean(busy)} className={button}>
              <Upload className="h-3 w-3" aria-hidden="true" />
              <span>{busy === 'upload' ? 'Uploading...' : 'Upload'}</span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,.pdf"
              aria-label="Tax map PDF file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) upload(file)
              }}
            />
          </>
        )}
      </div>
      {error && <p role="alert" className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
