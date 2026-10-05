import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { format, parseISO } from 'date-fns'
import SignedBanner from '../SignedBanner'

const SIGNED_AT = '2026-10-05T15:52:10Z'
const SUBMITTED_AT = '2026-09-25T16:05:23Z'
// Times render in the viewer's (here the test machine's) time zone, so the expected text is computed the same way
const local = iso => format(parseISO(iso), "MMM d, yyyy 'at' h:mm a")

function renderBanner(props) {
  render(<SignedBanner signedAt={null} submittedAt={null} signerName="" {...props} />)
  return screen.getByRole('status')
}

describe('SignedBanner', () => {
  it('says who submitted a signed IDR and when, from the signing time', () => {
    const banner = renderBanner({ signedAt: SIGNED_AT, submittedAt: SUBMITTED_AT, signerName: 'Reza Golestani' })
    expect(banner).toHaveTextContent(`Submitted by Reza Golestani on ${local(SIGNED_AT)}`)
    expect(banner.textContent).toMatch(/^Submitted by Reza Golestani on Oct \d{1,2}, 2026 at \d{1,2}:\d{2} [AP]M$/)
  })

  it('reads "Submitted on <date>" from the submit time for an IDR submitted before signatures', () => {
    const banner = renderBanner({ submittedAt: SUBMITTED_AT, signerName: 'Reza Golestani' })
    expect(banner).toHaveTextContent(`Submitted on ${local(SUBMITTED_AT)}`)
    expect(banner).not.toHaveTextContent('Reza')
  })

  it('reads "Submitted on <signing time>" while a signed IDR\'s signer is not known', () => {
    const banner = renderBanner({ signedAt: SIGNED_AT, submittedAt: SUBMITTED_AT })
    expect(banner).toHaveTextContent(`Submitted on ${local(SIGNED_AT)}`)
    expect(banner).not.toHaveTextContent(' by ')
  })

  it('still says Submitted when no time was recorded at all', () => {
    expect(renderBanner({}).textContent).toBe('Submitted')
  })

  it('is a green success notice with a check mark', () => {
    const banner = renderBanner({ signedAt: SIGNED_AT, signerName: 'Reza' })
    expect(banner.className).toContain('bg-emerald-50')
    expect(banner.querySelector('svg')).toBeInTheDocument()
  })
})
