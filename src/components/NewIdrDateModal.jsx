/**
 * "Pick a report date" dialog behind the dashboard's New Inspector Daily Diary button. The inspector picks any day
 * (today by default) and the dialog creates that day's IDR or finds the existing one. A draft opens straight away;
 * an already-submitted IDR (in review or approved included) asks first, since it opens view-only.
 * Props: projectId, onOpen(idrId), onClose.
 */
import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import Modal from './Modal'
import { createOrGetIdr } from '../services/api'

export const DATE_HELP =
  "Inspectors can file for any past date (e.g. yesterday's pour) or an upcoming date (e.g. a planned pour next week)."

export default function NewIdrDateModal({ projectId, onOpen, onClose }) {
  const [reportDate, setReportDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [submittedIdr, setSubmittedIdr] = useState(null) // set when that day's IDR exists and is already submitted

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (busy || !reportDate) return
    setBusy(true)
    setError(null)
    try {
      const { idr } = await createOrGetIdr({ projectId, reportDate })
      if (idr.status !== 'draft') {
        setSubmittedIdr(idr)
        setBusy(false)
      } else {
        onOpen(idr.idr_id)
      }
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  if (submittedIdr) {
    const day = format(parseISO(submittedIdr.report_date), 'MMM d, yyyy')
    const when = submittedIdr.submitted_at
      ? `Submitted ${format(parseISO(submittedIdr.submitted_at), "MMM d, yyyy 'at' h:mm a")}`
      : 'Submitted'
    return (
      <Modal
        title="Pick a report date"
        onClose={onClose}
        footer={
          <>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="button" onClick={() => onOpen(submittedIdr.idr_id)} className="btn-primary">Open</button>
          </>
        }
      >
        <p className="text-gray-700">
          You already have an IDR for {day} ({when} — view-only). Open it?
        </p>
      </Modal>
    )
  }

  return (
    <Modal
      title="Pick a report date"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" form="new-idr-date-form" disabled={busy || !reportDate} className="btn-primary">
            {busy ? 'Opening...' : 'Open / Create'}
          </button>
        </>
      }
    >
      <form id="new-idr-date-form" onSubmit={handleSubmit}>
        <label htmlFor="new-idr-report-date" className="input-label">Report date</label>
        <input
          id="new-idr-report-date"
          type="date"
          className="input-field"
          value={reportDate}
          disabled={busy}
          onChange={(e) => setReportDate(e.target.value)}
        />
        <p className="text-sm text-gray-500 mt-2">{DATE_HELP}</p>
        {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
      </form>
    </Modal>
  )
}
