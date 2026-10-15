import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SmartPirImportForm, { PIR_ID_HINT, countsText, droppedPlace } from '../SmartPirImportForm'
import * as api from '../../services/api'

vi.mock('../../services/api', () => ({ importSmartPir: vi.fn() }))

const PIR_ID = 'e0000000-0000-4000-8000-000000000001'
const SMART_PIR = {
  schema_version: '1.0',
  pir_id: PIR_ID,
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
const pirIdBox = () => screen.getByLabelText('PIR id')
const fileInput = () => screen.getByLabelText('Smart PIR file (.json)')
const importButton = () => screen.getByRole('button', { name: 'Import' })

async function importFile(file, id = PIR_ID) {
  const user = userEvent.setup()
  if (id) await user.type(pirIdBox(), id)
  await user.upload(fileInput(), file)
  await user.click(importButton())
  return user
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SmartPirImportForm — importing', () => {
  it('keeps Import off until a PIR id and a file are in', async () => {
    render(<SmartPirImportForm />)
    expect(importButton()).toBeDisabled()
    expect(fileInput()).toHaveAttribute('accept', '.json,application/json')
    const user = userEvent.setup()
    await user.upload(fileInput(), jsonFile(JSON.stringify(SMART_PIR)))
    expect(importButton()).toBeDisabled()
    await user.type(pirIdBox(), PIR_ID)
    expect(importButton()).toBeEnabled()
  })

  it('refuses a PIR id that is not a UUID, sending nothing', async () => {
    render(<SmartPirImportForm />)
    const user = userEvent.setup()
    await user.type(pirIdBox(), 'not-a-pir')
    await user.upload(fileInput(), jsonFile(JSON.stringify(SMART_PIR)))
    expect(screen.getByText(PIR_ID_HINT)).toBeInTheDocument()
    expect(pirIdBox()).toHaveAttribute('aria-invalid', 'true')
    expect(importButton()).toBeDisabled()
  })

  it('posts the parsed file to the PIR, then shows what went in and every dropped item with where it was and why', async () => {
    api.importSmartPir.mockResolvedValue(RESULT)
    render(<SmartPirImportForm />)
    const user = await importFile(jsonFile(JSON.stringify(SMART_PIR)), ` ${PIR_ID} `)

    expect(await screen.findByText(
      `Imported 4 flags, 2 non-assessable areas, 3 features, 2 curb segments and 1 title block into PIR ${PIR_ID}.`, { exact: false },
    )).toBeInTheDocument()
    expect(api.importSmartPir).toHaveBeenCalledWith(PIR_ID, SMART_PIR)
    expect(screen.getByText(/Set the scale, rotation or title block of 1 page\./)).toBeInTheDocument()
    expect(screen.getByText('Dropped 1 flag and 1 non-assessable area.')).toBeInTheDocument()
    const dropped = within(screen.getByRole('list', { name: 'Dropped items' })).getAllByRole('listitem')
    expect(dropped.map(item => item.textContent)).toEqual([
      'Page 1, flag 4: dimensions: L must be above 0',
      'Page 1, flag 1, non-assessable area 2: reason: not a non-assessable reason',
    ])

    await user.click(screen.getByRole('button', { name: 'Import another file' }))
    expect(pirIdBox()).toHaveDisplayValue('')
    expect(importButton()).toBeDisabled()
  })

  it('says nothing was dropped when nothing was', async () => {
    api.importSmartPir.mockResolvedValue({
      ...RESULT, dropped: { flags: 0, non_assessable_areas: 0, features: 0, segments: 0, annotations: 0 }, dropped_items: [], pages_updated: 0,
    })
    render(<SmartPirImportForm />)
    await importFile(jsonFile(JSON.stringify(SMART_PIR)))
    expect(await screen.findByText('Nothing was dropped.')).toBeInTheDocument()
    expect(screen.queryByText(/Set the scale/)).not.toBeInTheDocument()
  })

  it('refuses a file that is not JSON and sends nothing', async () => {
    render(<SmartPirImportForm />)
    await importFile(jsonFile('{ "schema_version": "1.0", '))
    expect(await screen.findByRole('alert')).toHaveTextContent(/^This file isn't valid JSON: /)
    expect(api.importSmartPir).not.toHaveBeenCalled()
    expect(importButton()).toBeEnabled()
  })

  it("shows the backend's refusal as worded and keeps the id and file for another try", async () => {
    api.importSmartPir.mockRejectedValueOnce(Object.assign(new Error('PIR not found'), { status: 404 }))
    render(<SmartPirImportForm />)
    const user = await importFile(jsonFile(JSON.stringify(SMART_PIR)))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't import the file: PIR not found")
    expect(pirIdBox()).toHaveDisplayValue(PIR_ID)

    api.importSmartPir.mockResolvedValueOnce(RESULT)
    await user.click(importButton())
    expect(await screen.findByText(/Imported 4 flags/)).toBeInTheDocument()
  })
})

describe('SmartPirImportForm — wording', () => {
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
