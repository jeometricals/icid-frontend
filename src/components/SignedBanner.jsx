import { CheckCircle2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const WHEN = "MMM d, yyyy 'at' h:mm a" // shown in the viewer's own time zone

/**
 * The notice across a submitted IDR's page saying it is submitted, and, for a signed IDR, by whom and when:
 * "Submitted by Reza Golestani on Oct 5, 2026 at 11:52 AM". An IDR submitted before signatures existed (no signedAt),
 * or one whose signer's name isn't known, reads "Submitted on <date>" from its submit time instead.
 * Props: signedAt and submittedAt (ISO strings or null), signerName (the name to show, or '' when unknown).
 */
export default function SignedBanner({ signedAt, submittedAt, signerName }) {
  return (
    <div
      role="status"
      className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-3 mb-6 text-sm font-medium"
    >
      <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
      <span>{bannerText({ signedAt, submittedAt, signerName })}</span>
    </div>
  )
}

function bannerText({ signedAt, submittedAt, signerName }) {
  if (signedAt && signerName) return `Submitted by ${signerName} on ${format(parseISO(signedAt), WHEN)}`
  const when = signedAt || submittedAt
  // No DB constraint guarantees a submit time, so don't let a null crash the page
  return when ? `Submitted on ${format(parseISO(when), WHEN)}` : 'Submitted'
}
