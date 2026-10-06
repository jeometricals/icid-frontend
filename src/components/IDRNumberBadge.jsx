import { Hash } from 'lucide-react'

/**
 * An IDR's number, as the reviewer typed it at Stage 1: "IDR # 005". Before a reviewer has picked the IDR up it has
 * none, and the badge reads "No IDR # yet". Props: number (the IDR's idr_number, or null).
 */
export default function IDRNumberBadge({ number }) {
  if (!number) {
    return <span className="inline-flex items-center text-xs text-gray-500 whitespace-nowrap">No IDR # yet</span>
  }
  return (
    <span className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs font-semibold text-gray-800 whitespace-nowrap">
      <Hash className="h-3 w-3 mr-0.5 text-gray-500" aria-hidden="true" />
      <span className="sr-only">IDR number </span>
      {number}
    </span>
  )
}
