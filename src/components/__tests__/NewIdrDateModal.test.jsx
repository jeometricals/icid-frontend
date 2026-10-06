import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { format, parseISO } from 'date-fns'
import NewIdrDateModal, { DATE_HELP } from '../NewIdrDateModal'
import * as api from '../../services/api'

vi.mock('../../services/api', () => ({
  createOrGetIdr: vi.fn(),
}))

const SUBMITTED_AT = '2026-09-25T21:10:00Z'

function renderModal() {
  const handlers = { onOpen: vi.fn(), onClose: vi.fn() }
  render(<NewIdrDateModal projectId="HWS0023" {...handlers} />)
  return handlers
}

const dateInput = () => screen.getByLabelText('Report date')
const submit = () => userEvent.click(screen.getByRole('button', { name: 'Open / Create' }))

async function pickDate(value) {
  await userEvent.clear(dateInput())
  await userEvent.type(dateInput(), value)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('NewIdrDateModal — picking a date', () => {
  it('opens on today, with the helper line and both buttons', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Pick a report date' })).toBeInTheDocument()
    expect(dateInput()).toHaveAttribute('type', 'date')
    expect(dateInput()).toHaveValue(format(new Date(), 'yyyy-MM-dd'))
    expect(screen.getByText(DATE_HELP)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('creates the IDR for a past date and opens a new draft', async () => {
    api.createOrGetIdr.mockResolvedValue({ idr: { idr_id: 'idr-new', status: 'draft' }, isNew: true })
    const { onOpen } = renderModal()
    await pickDate('2026-09-24')
    await submit()
    expect(api.createOrGetIdr).toHaveBeenCalledWith({ projectId: 'HWS0023', reportDate: '2026-09-24' })
    expect(onOpen).toHaveBeenCalledWith('idr-new')
  })

  it("opens that day's existing draft straight away", async () => {
    api.createOrGetIdr.mockResolvedValue({ idr: { idr_id: 'idr-draft', status: 'draft' }, isNew: false })
    const { onOpen } = renderModal()
    await submit()
    expect(onOpen).toHaveBeenCalledWith('idr-draft')
  })

  it('disables the submit button while the date is empty', async () => {
    renderModal()
    await userEvent.clear(dateInput())
    expect(screen.getByRole('button', { name: 'Open / Create' })).toBeDisabled()
  })

  it('shows "Opening..." and ignores a second submit while the request runs', async () => {
    api.createOrGetIdr.mockReturnValue(new Promise(() => {}))
    renderModal()
    await submit()
    const busy = screen.getByRole('button', { name: 'Opening...' })
    expect(busy).toBeDisabled()
    await userEvent.click(busy)
    expect(api.createOrGetIdr).toHaveBeenCalledTimes(1)
  })

  it('shows a failure inline and stays open', async () => {
    api.createOrGetIdr.mockRejectedValue(new Error('Reporter is not assigned to this project'))
    const { onOpen, onClose } = renderModal()
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Reporter is not assigned to this project')
    expect(onOpen).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Open / Create' })).toBeEnabled()
  })

  it('Cancel closes without creating anything', async () => {
    const { onClose } = renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
    expect(api.createOrGetIdr).not.toHaveBeenCalled()
  })
})

describe('NewIdrDateModal — the day is already submitted', () => {
  const submitted = { idr_id: 'idr-done', status: 'submitted', report_date: '2026-09-25', submitted_at: SUBMITTED_AT }

  it('asks before opening, naming the day and when it was submitted', async () => {
    api.createOrGetIdr.mockResolvedValue({ idr: submitted, isNew: false })
    const { onOpen } = renderModal()
    await pickDate('2026-09-25')
    await submit()
    const when = format(parseISO(SUBMITTED_AT), "MMM d, yyyy 'at' h:mm a")
    expect(await screen.findByText(`You already have an IDR for Sep 25, 2026 (Submitted ${when} — view-only). Open it?`))
      .toBeInTheDocument()
    expect(onOpen).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Report date')).not.toBeInTheDocument()
  })

  it('Open opens it', async () => {
    api.createOrGetIdr.mockResolvedValue({ idr: submitted, isNew: false })
    const { onOpen } = renderModal()
    await submit()
    await userEvent.click(await screen.findByRole('button', { name: 'Open' }))
    expect(onOpen).toHaveBeenCalledWith('idr-done')
  })

  it('Cancel closes without opening it', async () => {
    api.createOrGetIdr.mockResolvedValue({ idr: submitted, isNew: false })
    const { onOpen, onClose } = renderModal()
    await submit()
    await screen.findByRole('button', { name: 'Open' })
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onOpen).not.toHaveBeenCalled()
  })
})

describe('NewIdrDateModal — the day is already in review or approved', () => {
  it.each(['stage1_review', 'stage2_review', 'approved'])('asks before opening a %s IDR, like a submitted one', async (status) => {
    const idr = { idr_id: 'idr-done', status, report_date: '2026-09-25', submitted_at: SUBMITTED_AT }
    api.createOrGetIdr.mockResolvedValue({ idr, isNew: false })
    const onOpen = vi.fn()
    render(<NewIdrDateModal projectId="HWS0023" onOpen={onOpen} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open / Create' }))
    expect(await screen.findByText(/view-only\)\. Open it\?/)).toBeInTheDocument()
    expect(onOpen).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(onOpen).toHaveBeenCalledWith('idr-done')
  })
})
