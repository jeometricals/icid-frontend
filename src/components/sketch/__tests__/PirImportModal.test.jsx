import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PirImportModal, { countsText, droppedPlace } from '../PirImportModal'
import * as api from '../../../services/api'

vi.mock('../../../services/api', () => ({ importSmartPir: vi.fn() }))

const SMART_PIR = {
  schema_version: '1.0',
  pir_id: 'pir-1',
  pages: [{ page_number: 1, scale_px_per_ft: 15, flags: [], features: [], segments: [] }],
}
const RESULT = {
  inserted: { flags: 4, non_assessable_areas: 2, features: 3, segments: 2, annotations: 1 },
  dropped: { flags: 1, non_assessable_areas: 1, features: 0, segments: 0, annotations: 0 },
  dropped_items: [
    { kind: 'flag', page_number: 1, index: 3, flag_index: null, reason: 'dimensions: L must be above 0' },
    { kind: 'non_assessable_area', page_number: 1, index: 1, flag_index: 0, reason: 'reason: not a non-assessable reason' },
  ],
  pages_updated: 1,
}

const jsonFile = (text, name = 'smart-pir.json') => new File([text], name, { type: 'application/json' })

function renderModal() {
  const handlers = { onImported: vi.fn(), onClose: vi.fn() }
  render(<PirImportModal pirId="pir-1" {...handlers} />)
  return handlers
}

async function importFile(file) {
  const user = userEvent.setup()
  await user.upload(screen.getByLabelText('Smart PIR file (.json)'), file)
  await user.click(screen.getByRole('button', { name: 'Import' }))
  return user
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PirImportModal — importing', () => {
  it('keeps Import off until a file is picked', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Import SMART PIR' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
    expect(screen.getByLabelText('Smart PIR file (.json)')).toHaveAttribute('accept', '.json,application/json')
  })

  it('posts the parsed file, then shows what went in and every dropped item with where it was and why', async () => {
    api.importSmartPir.mockResolvedValue(RESULT)
    const { onImported, onClose } = renderModal()
    const user = await importFile(jsonFile(JSON.stringify(SMART_PIR)))

    expect(await screen.findByText(/Imported 4 flags, 2 non-assessable areas, 3 features, 2 curb segments and 1 title block\./))
      .toBeInTheDocument()
    expect(api.importSmartPir).toHaveBeenCalledWith('pir-1', SMART_PIR)
    expect(onImported).toHaveBeenCalledWith(RESULT)
    expect(screen.getByText(/Set the scale, rotation or title block of 1 page\./)).toBeInTheDocument()
    expect(screen.getByText('Dropped 1 flag and 1 non-assessable area.')).toBeInTheDocument()
    const dropped = within(screen.getByRole('list', { name: 'Dropped items' })).getAllByRole('listitem')
    expect(dropped.map(item => item.textContent)).toEqual([
      'Page 1, flag 4: dimensions: L must be above 0',
      'Page 1, flag 1, non-assessable area 2: reason: not a non-assessable reason',
    ])

    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('says nothing was dropped when nothing was', async () => {
    api.importSmartPir.mockResolvedValue({
      ...RESULT, dropped: { flags: 0, non_assessable_areas: 0, features: 0, segments: 0, annotations: 0 }, dropped_items: [], pages_updated: 0,
    })
    renderModal()
    await importFile(jsonFile(JSON.stringify(SMART_PIR)))
    expect(await screen.findByText('Nothing was dropped.')).toBeInTheDocument()
    expect(screen.queryByText(/Set the scale/)).not.toBeInTheDocument()
  })

  it('refuses a file that is not JSON, sends nothing and keeps the dialog open', async () => {
    const { onImported } = renderModal()
    await importFile(jsonFile('{ "schema_version": "1.0", '))
    expect(await screen.findByRole('alert')).toHaveTextContent(/^This file isn't valid JSON: /)
    expect(api.importSmartPir).not.toHaveBeenCalled()
    expect(onImported).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled()
  })

  it("shows the backend's refusal as worded and keeps the file for another try", async () => {
    api.importSmartPir.mockRejectedValueOnce(Object.assign(new Error("The file's pir_id is not this PIR"), { status: 400 }))
    const { onImported } = renderModal()
    const user = await importFile(jsonFile(JSON.stringify(SMART_PIR)))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't import the file: The file's pir_id is not this PIR")
    expect(onImported).not.toHaveBeenCalled()

    api.importSmartPir.mockResolvedValueOnce(RESULT)
    await user.click(screen.getByRole('button', { name: 'Import' }))
    expect(await screen.findByText(/Imported 4 flags/)).toBeInTheDocument()
  })
})

describe('PirImportModal — wording', () => {
  it('lists the kinds with a count', () => {
    expect(countsText({ flags: 1 })).toBe('1 flag')
    expect(countsText({ flags: 0, segments: 2 })).toBe('2 curb segments')
    expect(countsText({})).toBe('nothing')
  })

  it('names where a dropped item was, counting from 1', () => {
    expect(droppedPlace({ kind: 'feature', page_number: 2, index: 0 })).toBe('Page 2, feature 1')
    expect(droppedPlace({ kind: 'annotations', page_number: 3, index: null })).toBe('Page 3, title block')
    expect(droppedPlace({ kind: 'annotations', page_number: null, index: null })).toBe("The file's title block")
  })
})
