import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { format } from 'date-fns'
import IdrReportRow from '../IdrReportRow'

const REPORT = {
  report_id: 'rep-1',
  report_type: 'GEN',
  is_addendum: false,
  parent_report_id: null,
  page_number: null,
  report_data: {},
  created_at: '2026-09-25T13:00:00Z',
  updated_at: '2026-09-25T13:00:00Z',
}

const EDITED = { ...REPORT, report_data: { description: 'Poured curb' }, updated_at: '2026-09-25T14:05:00Z' }

function renderRow(props = {}) {
  const handlers = { onOpen: vi.fn(), onDelete: vi.fn() }
  render(
    <ul>
      <IdrReportRow report={REPORT} totalPages={null} readOnly={false} disabled={false} deleting={false} {...handlers} {...props} />
    </ul>
  )
  return handlers
}

describe('IdrReportRow', () => {
  it('shows the report type name', () => {
    renderRow()
    expect(screen.getByText('General')).toBeInTheDocument()
  })

  it('falls back to the raw code for types without a label', () => {
    renderRow({ report: { ...REPORT, report_type: 'SWR' } })
    expect(screen.getByText('SWR')).toBeInTheDocument()
  })

  it('shows an addendum chip only for addendums', () => {
    renderRow({ report: { ...REPORT, report_type: 'SKETCH', is_addendum: true } })
    expect(screen.getByText('addendum')).toBeInTheDocument()
  })

  it('has no addendum chip for a main report', () => {
    renderRow()
    expect(screen.queryByText('addendum')).not.toBeInTheDocument()
  })

  it('shows "Not yet edited" when report_data is empty', () => {
    renderRow()
    expect(screen.getByText('Not yet edited')).toBeInTheDocument()
  })

  it('shows "Saved HH:MM" (local time) when report_data has content', () => {
    renderRow({ report: EDITED })
    expect(screen.getByText(`Saved ${format(new Date(EDITED.updated_at), 'HH:mm')}`)).toBeInTheDocument()
  })

  it('shows plain "Saved" when read-only (submit bumps updated_at, so the time would mislead)', () => {
    renderRow({ report: EDITED, readOnly: true })
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('shows "Page X of Y" only when read-only and both numbers exist', () => {
    renderRow({ report: { ...REPORT, page_number: 2 }, totalPages: 3, readOnly: true })
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
  })

  it.each([
    ['page_number is null (migrated IDR)', null, 3],
    ['total_pages is null (migrated IDR)', 1, null],
  ])('omits the page indicator when %s', (_, pageNumber, totalPages) => {
    renderRow({ report: { ...REPORT, page_number: pageNumber }, totalPages, readOnly: true })
    expect(screen.queryByText(/^Page /)).not.toBeInTheDocument()
  })

  it('calls onOpen and onDelete', async () => {
    const user = userEvent.setup()
    const { onOpen, onDelete } = renderRow()
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.click(screen.getByRole('button', { name: /delete/i }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('disables Open for types that have no form page yet', () => {
    renderRow({ report: { ...REPORT, report_type: 'SWR' } })
    expect(screen.getByRole('button', { name: 'Open' })).toBeDisabled()
  })

  it('hides Delete when read-only but keeps Open', () => {
    renderRow({ readOnly: true })
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open' })).toBeEnabled()
  })

  it('shows "Deleting..." and disables Delete while this row is being deleted', () => {
    renderRow({ deleting: true })
    expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled()
  })

  it('disables Delete while another action is running', () => {
    renderRow({ disabled: true })
    expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled()
  })
})
