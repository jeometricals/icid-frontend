import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExportIdrButton from '../ExportIdrButton'
import * as api from '../../services/api'

vi.mock('../../services/api', () => ({
  generateExport: vi.fn(),
}))

const IDR_ID = 'idr-1'

beforeEach(() => {
  vi.clearAllMocks()
})

// A promise the test settles by hand, to look at the button mid-export
function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const exportButton = () => screen.getByRole('button', { name: /export/i })

describe('ExportIdrButton', () => {
  it('is labelled for a draft or a submitted IDR', () => {
    const { rerender } = render(<ExportIdrButton idrId={IDR_ID} isDraft />)
    expect(exportButton()).toHaveTextContent('Export Draft (.xlsx)')
    rerender(<ExportIdrButton idrId={IDR_ID} isDraft={false} />)
    expect(exportButton()).toHaveTextContent('Export (.xlsx)')
  })

  it('exports this IDR, explaining the wait while it runs', async () => {
    const pending = deferred()
    api.generateExport.mockReturnValue(pending.promise)
    render(<ExportIdrButton idrId={IDR_ID} isDraft />)
    await userEvent.click(exportButton())
    expect(api.generateExport).toHaveBeenCalledWith(IDR_ID)
    expect(exportButton()).toBeDisabled()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Preparing export… this can take up to a minute with photos')).toBeInTheDocument()

    pending.resolve('IDR.xlsx')
    await waitFor(() => expect(exportButton()).toBeEnabled())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a failure with Retry, which exports again', async () => {
    api.generateExport.mockRejectedValueOnce(Object.assign(new Error('Storage is down'), { status: 502 }))
    api.generateExport.mockResolvedValueOnce('IDR.xlsx')
    render(<ExportIdrButton idrId={IDR_ID} isDraft />)
    await userEvent.click(exportButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Export failed: Storage is down')

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(api.generateExport).toHaveBeenCalledTimes(2)
  })

  it('says a deleted IDR is gone, without Retry', async () => {
    api.generateExport.mockRejectedValue(Object.assign(new Error('IDR not found'), { status: 404 }))
    render(<ExportIdrButton idrId={IDR_ID} isDraft={false} />)
    await userEvent.click(exportButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('This IDR no longer exists')
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('does nothing while disabled', async () => {
    render(<ExportIdrButton idrId={IDR_ID} isDraft disabled />)
    expect(exportButton()).toBeDisabled()
    await userEvent.click(exportButton())
    expect(api.generateExport).not.toHaveBeenCalled()
  })
})
