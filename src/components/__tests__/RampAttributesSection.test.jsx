import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RampAttributesSection, { NOT_ENTERED, WITHIN } from '../RampAttributesSection'
import { rampKeys } from '../../data/pedRampForm'
import * as api from '../../services/api'

vi.mock('../../services/api', () => ({ getRampAttributes: vi.fn(), saveRampAttributes: vi.fn() }))

const RAMP = { id: 'c0000000-0000-4000-8000-000000000002', project_id: 'HWS0023', kind: 'ped_ramp',
  ramp_type: 'PERPENDICULAR' }
const WARNING = { field: 'ramp_running_slope_pct', value: 9.1, limit: 'at most 8.3%',
  message: 'Ramp running slope 9.1% exceeds 8.3%' }
const SAVED = { property_id: RAMP.id, ramp_type: 'PERPENDICULAR', ramp_id_label: 'R1', ramp_running_slope_pct: 9.1,
  is_there_ponding: false, warnings: [WARNING] }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RampAttributesSection', () => {
  it('reads "Not entered yet." for a ramp without attributes, with its type\'s fields', async () => {
    api.getRampAttributes.mockResolvedValue(null)
    render(<RampAttributesSection property={RAMP} canEdit />)
    expect(await screen.findByText(NOT_ENTERED)).toBeInTheDocument()
    expect(screen.getByLabelText('Left flare slope')).toBeInTheDocument()
    expect(screen.queryByLabelText('Cut-through length')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('lists the warnings and marks their fields', async () => {
    api.getRampAttributes.mockResolvedValue(SAVED)
    render(<RampAttributesSection property={RAMP} canEdit />)
    expect(await screen.findByText('Ramp running slope 9.1% exceeds 8.3%')).toBeInTheDocument()
    expect(screen.getByText('1 ADA warning (saved anyway)')).toBeInTheDocument()
    expect(screen.getByLabelText(/Ramp running slope/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/Ramp running slope/)).toHaveValue('9.1')
    expect(screen.getByLabelText('Is there ponding')).toHaveValue('false')
  })

  it('saves the whole set for its type, and shows what came back', async () => {
    const user = userEvent.setup()
    api.getRampAttributes.mockResolvedValue(SAVED)
    api.saveRampAttributes.mockResolvedValue({ ...SAVED, ramp_running_slope_pct: 7.5, warnings: [] })
    render(<RampAttributesSection property={RAMP} canEdit />)
    const slope = await screen.findByLabelText(/Ramp running slope/)
    await user.clear(slope)
    await user.type(slope, '7.5')
    await user.selectOptions(screen.getByLabelText('DWS color'), 'dark_on_light')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText(WITHIN)).toBeInTheDocument())
    const sent = api.saveRampAttributes.mock.calls[0][1]
    expect(Object.keys(sent).sort()).toEqual(rampKeys('PERPENDICULAR').sort())
    expect(sent).toMatchObject({ ramp_id_label: 'R1', ramp_running_slope_pct: 7.5, is_there_ponding: false,
      dws_color: 'dark_on_light', ramp_width_in: null, comments: null })
  })

  it('keeps Save off while a measurement isn\'t a number', async () => {
    const user = userEvent.setup()
    api.getRampAttributes.mockResolvedValue(null)
    render(<RampAttributesSection property={RAMP} canEdit />)
    await user.type(await screen.findByLabelText('Ramp width'), 'wide')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByText('Slopes and lengths must be numbers.')).toBeInTheDocument()
  })

  it('shows a cut-through its own fields, and is read-only for someone who can\'t change the site', async () => {
    api.getRampAttributes.mockResolvedValue(null)
    render(<RampAttributesSection property={{ ...RAMP, ramp_type: 'CUT_THROUGH' }} canEdit={false} />)
    expect(await screen.findByLabelText('Cut-through length')).toBeDisabled()
    expect(screen.queryByLabelText('Landing length')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('shows a refused save', async () => {
    const user = userEvent.setup()
    api.getRampAttributes.mockResolvedValue(null)
    api.saveRampAttributes.mockRejectedValue(Object.assign(new Error('Property is deleted'), { status: 400 }))
    render(<RampAttributesSection property={RAMP} canEdit />)
    await user.type(await screen.findByLabelText('Ramp width'), '60')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Property is deleted')).toBeInTheDocument()
  })
})
