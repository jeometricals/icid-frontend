import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TitleBlockEditor, { DEMO_TITLE, ORDER_WARNING } from '../TitleBlockEditor'
import * as api from '../../services/api'

vi.mock('../../services/api', () => ({ updatePirTitleBlock: vi.fn() }))

const PIR_ID = 'e0000000-0000-4000-8000-000000000001'
const BLOCK = { contract_no: 'HWS2014Q', date_notice_issued: null, date_excavated: '2026-10-01',
  date_constructed: null, north_bearing: null, cross_street_left: '139 AVENUE', cross_street_right: null,
  frontage_street: '227 STREET', tax_map_width_ft: 40, cc_curb_to_curb_ft: null }

let props
function renderEditor(overrides = {}) {
  props = { pirId: PIR_ID, titleBlock: BLOCK, canEdit: true, onSaved: vi.fn(), onGone: vi.fn(), onClose: vi.fn(), ...overrides }
  render(<TitleBlockEditor {...props} />)
}
const field = (label) => screen.getByLabelText(label)
const save = () => screen.getByRole('button', { name: 'Save' })

beforeEach(() => { vi.clearAllMocks() })

describe('TitleBlockEditor', () => {
  it('opens on page 1 with the current values', () => {
    renderEditor()
    expect(screen.getByRole('dialog', { name: 'Title block — Page 1' })).toBeInTheDocument()
    expect(field('Contract No.')).toHaveValue('HWS2014Q')
    expect(field('Date Excavated')).toHaveValue('2026-10-01')
    expect(field('Date Constructed')).toHaveValue('')
    expect(field('North Bearing')).toHaveValue('')
    expect([...field('North Bearing').options].map(o => o.textContent)).toEqual(['—', 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])
  })

  it('keeps Save off until something changes', async () => {
    renderEditor()
    expect(save()).toBeDisabled()
    await userEvent.selectOptions(field('North Bearing'), 'N')
    expect(save()).toBeEnabled()
  })

  it('sends only what changed, a cleared field as null', async () => {
    api.updatePirTitleBlock.mockResolvedValue({ ...BLOCK, pir_id: PIR_ID })
    renderEditor()
    await userEvent.clear(field('Contract No.'))
    fireEvent.change(field('Date Constructed'), { target: { value: '2026-10-05' } })
    await userEvent.selectOptions(field('North Bearing'), 'NE')
    await userEvent.click(save())
    expect(api.updatePirTitleBlock).toHaveBeenCalledWith(PIR_ID,
      { contract_no: null, date_constructed: '2026-10-05', north_bearing: 'NE' })
    expect(props.onSaved).toHaveBeenCalledWith({ ...BLOCK, pir_id: PIR_ID })
  })

  it('shows a refusal under Save and stays open', async () => {
    api.updatePirTitleBlock.mockRejectedValue(Object.assign(new Error('date_constructed must be a date (YYYY-MM-DD)'), { status: 400 }))
    renderEditor()
    fireEvent.change(field('Date Constructed'), { target: { value: '2026-10-05' } })
    await userEvent.click(save())
    expect(await screen.findByRole('alert')).toHaveTextContent('date_constructed must be a date (YYYY-MM-DD)')
    expect(props.onSaved).not.toHaveBeenCalled()
    expect(save()).toBeEnabled()
  })

  it('hands a 404 to onGone', async () => {
    api.updatePirTitleBlock.mockRejectedValue(Object.assign(new Error('PIR not found'), { status: 404 }))
    renderEditor()
    await userEvent.selectOptions(field('North Bearing'), 'S')
    await userEvent.click(save())
    expect(props.onGone).toHaveBeenCalledWith('PIR not found')
  })

  it('warns, softly, when Date Excavated is after Date Constructed', () => {
    renderEditor()
    expect(screen.queryByText(ORDER_WARNING)).not.toBeInTheDocument()
    fireEvent.change(field('Date Constructed'), { target: { value: '2026-09-30' } })
    expect(screen.getByText(ORDER_WARNING)).toBeInTheDocument()
    expect(save()).toBeEnabled()
  })

  it('is read-only for a reader: fields off, no Save, Close', async () => {
    renderEditor({ canEdit: false })
    expect(screen.getByText(DEMO_TITLE)).toBeInTheDocument()
    for (const label of ['Contract No.', 'Date Notice Issued', 'Date Excavated', 'Date Constructed', 'North Bearing',
      /Left street/, /Frontage street/, /Tax map width/]) {
      expect(field(label)).toBeDisabled()
    }
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('Close', { selector: 'button' })) // the footer's, not the X
    expect(props.onClose).toHaveBeenCalled()
  })

  it('has a Streets group seeded with the streets, and a width as its number', () => {
    renderEditor()
    expect(screen.getByRole('group', { name: 'Streets' })).toBeInTheDocument()
    expect(field(/Left street/)).toHaveValue('139 AVENUE')
    expect(field(/Right street/)).toHaveValue('')
    expect(field(/Frontage street/)).toHaveValue('227 STREET')
    expect(field(/Tax map width/)).toHaveValue('40')
    expect(field(/Curb to curb/)).toHaveValue('')
    expect(field(/Left street/)).toHaveAttribute('maxLength', '60')
  })

  it('sends only the streets and widths changed, a width as typed and a cleared street as null', async () => {
    api.updatePirTitleBlock.mockResolvedValue({ ...BLOCK, pir_id: PIR_ID })
    renderEditor()
    await userEvent.type(field(/Right street/), '138 AVENUE')
    await userEvent.clear(field(/Frontage street/))
    await userEvent.type(field(/Curb to curb/), '34.25')
    await userEvent.click(save())
    expect(api.updatePirTitleBlock).toHaveBeenCalledWith(PIR_ID,
      { cross_street_right: '138 AVENUE', frontage_street: null, cc_curb_to_curb_ft: '34.25' })
  })

  it('shows a width the backend refuses under Save', async () => {
    api.updatePirTitleBlock.mockRejectedValue(Object.assign(
      new Error('tax_map_width_ft must be a number of feet, at least 0, with at most 2 decimal places'), { status: 400 }))
    renderEditor()
    await userEvent.clear(field(/Tax map width/))
    await userEvent.type(field(/Tax map width/), '-4')
    await userEvent.click(save())
    expect(await screen.findByRole('alert')).toHaveTextContent('tax_map_width_ft must be a number of feet')
  })
})
