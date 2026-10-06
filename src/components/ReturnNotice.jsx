import { CornerUpLeft } from 'lucide-react'

const FROM = { stage1: 'IDR Check', stage2: 'RE Review' }

/**
 * The notice across an IDR's page while it carries a reviewer's return comment: on a draft sent back to its
 * inspector, and on an IDR the RE sent back to the OE. Shows where it came back from and the comment.
 * Props: reason (the IDR's return_reason), returnedFrom ('stage1' | 'stage2' | null).
 */
export default function ReturnNotice({ reason, returnedFrom }) {
  return (
    <div
      role="status"
      className="flex items-start space-x-2 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 mb-6 text-sm"
    >
      <CornerUpLeft className="h-5 w-5 flex-shrink-0" />
      <div>
        <p className="font-medium">Returned{FROM[returnedFrom] ? ` from ${FROM[returnedFrom]}` : ''}</p>
        <p className="mt-1 whitespace-pre-wrap">{reason}</p>
      </div>
    </div>
  )
}
