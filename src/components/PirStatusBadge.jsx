import { PIR_STATUS, pirStatus } from '../lib/pirs'

const TONES = {
  dotSigned: 'bg-blue-100 text-blue-800',
  asBuiltSigned: 'bg-green-100 text-green-800',
}

/**
 * How far a property's PIR has got, as a small pill: "Signed by DOT" or "As-built signed"; a plain dash when the
 * property has no live PIR. Props: pir (the live PIR, or null), or status (a PIR_STATUS key, e.g. from
 * pirStatusFromApi), which wins when given.
 */
export default function PirStatusBadge({ pir, status: given }) {
  const status = given ?? pirStatus(pir)
  if (status === 'none') return <span className="text-gray-400">{PIR_STATUS.none.label}</span>
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${TONES[status]}`}>
      {PIR_STATUS[status].label}
    </span>
  )
}
