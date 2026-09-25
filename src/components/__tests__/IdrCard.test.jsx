import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { format, parseISO } from 'date-fns'
import IdrCard from '../IdrCard'

const DRAFT = {
  idr_id: 'idr-1',
  report_date: '2026-09-25',
  status: 'draft',
  report_count: 3,
  has_general: true,
  submitted_at: null,
  updated_at: '2026-09-25T16:07:38Z',
}

const SUBMITTED = {
  ...DRAFT,
  status: 'submitted',
  submitted_at: '2026-09-25T16:05:23Z',
  updated_at: '2026-09-25T16:05:23Z',
}

// Timestamps render in the test machine's time zone, so the expected clock time is computed the same way
const localTime = iso => format(parseISO(iso), 'h:mm a')

describe('IdrCard', () => {
  it('shows the IDR date in local time (no off-by-one day)', () => {
    render(<IdrCard idr={{ ...DRAFT, report_date: '2025-09-16' }} onOpen={() => {}} />)
    expect(screen.getByText('Sep 16, 2025')).toBeInTheDocument()
  })

  it.each([
    [3, true, '3 reports · With General'],
    [1, true, '1 report · General only'],
    [2, false, '2 reports · No General'],
    [1, false, '1 report · No General'],
    [0, false, 'No reports yet'],
  ])('summarises %i report(s), has_general=%s as "%s"', (count, hasGeneral, text) => {
    render(<IdrCard idr={{ ...DRAFT, report_count: count, has_general: hasGeneral }} onOpen={() => {}} />)
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('shows "Last edited" for a draft', () => {
    render(<IdrCard idr={DRAFT} onOpen={() => {}} />)
    expect(screen.getByText(`Last edited Sep 25, ${localTime(DRAFT.updated_at)}`)).toBeInTheDocument()
  })

  it('shows the submission date and time for a submitted IDR', () => {
    render(<IdrCard idr={SUBMITTED} onOpen={() => {}} />)
    expect(screen.getByText(`Submitted Sep 25, 2026 at ${localTime(SUBMITTED.submitted_at)}`)).toBeInTheDocument()
  })

  it('falls back gracefully when submitted_at is missing', () => {
    render(<IdrCard idr={{ ...SUBMITTED, submitted_at: null }} onOpen={() => {}} />)
    expect(screen.getByText('Submitted (date unknown)')).toBeInTheDocument()
  })

  it('shows the inspector only when a reporterName is given', () => {
    const { rerender } = render(<IdrCard idr={SUBMITTED} onOpen={() => {}} />)
    expect(screen.queryByText(/inspector:/i)).not.toBeInTheDocument()

    rerender(<IdrCard idr={SUBMITTED} onOpen={() => {}} reporterName="Nadir Shah" />)
    expect(screen.getByText('Inspector: Nadir Shah')).toBeInTheDocument()
  })

  it('calls onOpen when clicked', async () => {
    const onOpen = vi.fn()
    render(<IdrCard idr={DRAFT} onOpen={onOpen} />)
    await userEvent.setup().click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
