import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DownloadConstructionReportButton, { NOT_COVERED } from '../DownloadConstructionReportButton'
import { SKETCH_TOO_LARGE_MESSAGE } from '../../services/constructionReport'

const failure = (status, message) => Object.assign(new Error(message), { status })

function renderButton(props = {}) {
  const download = props.download ?? vi.fn().mockResolvedValue('report.pdf')
  render(<DownloadConstructionReportButton label="Download Construction Report" download={download} {...props} />)
  return download
}

const button = () => screen.getByRole('button', { name: 'Download Construction Report' })

describe('DownloadConstructionReportButton', () => {
  it('downloads on click', async () => {
    const download = renderButton()
    await userEvent.click(button())
    expect(download).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('is off, with the reason as its tooltip, until a report can be made', () => {
    renderButton({ enabled: false, disabledTitle: NOT_COVERED })
    expect(button()).toBeDisabled()
    expect(button()).toHaveAttribute('title', NOT_COVERED)
  })

  it('says it is working while the report is made, and is off meanwhile', async () => {
    let finish
    renderButton({ download: vi.fn(() => new Promise(resolve => { finish = resolve })) })
    await userEvent.click(button())
    expect(button()).toBeDisabled()
    expect(screen.getByRole('status')).toBeInTheDocument()
    finish()
    expect(await screen.findByRole('button', { name: 'Download Construction Report' })).toBeEnabled()
  })

  it("shows the backend's own words for a sketch too large, with no Retry", async () => {
    renderButton({ download: vi.fn().mockRejectedValue(failure(422, SKETCH_TOO_LARGE_MESSAGE)) })
    await userEvent.click(button())
    expect(await screen.findByRole('alert')).toHaveTextContent(SKETCH_TOO_LARGE_MESSAGE)
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('shows a 404 as the backend words it, with no Retry', async () => {
    renderButton({ download: vi.fn().mockRejectedValue(failure(404, "No approved IDR covers this property's flags")) })
    await userEvent.click(button())
    expect(await screen.findByRole('alert')).toHaveTextContent("No approved IDR covers this property's flags")
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('offers Retry after a network failure, and Retry tries again', async () => {
    const download = vi.fn().mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValueOnce('report.pdf')
    renderButton({ download })
    await userEvent.click(button())
    expect(await screen.findByRole('alert')).toHaveTextContent('Download failed: Failed to fetch')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(download).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
