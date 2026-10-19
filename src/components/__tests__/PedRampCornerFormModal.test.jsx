import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PedRampCornerFormModal from '../PedRampCornerFormModal'

const CORNER = { corner_id: 'd0000000-0000-4000-8000-000000000001', project_id: 'HWS0023', boro: 'Queens',
  north_south_street: '38th St', east_west_street: '31st Ave', corner_direction: 'SW', number_of_ramps: 2,
  t_intersection: false, inspection_date: '2026-10-19', comments: null, ramps: [] }

function renderModal(props = {}) {
  const onSave = vi.fn()
  render(<PedRampCornerFormModal onSave={onSave} onCancel={vi.fn()} {...props} />)
  return { onSave }
}

const save = () => screen.getByRole('button', { name: 'Save' })

describe('PedRampCornerFormModal', () => {
  it('lays out the form\'s three sections', () => {
    renderModal()
    for (const legend of ['1. Inspection information', '2. Location information', '3. Construction information']) {
      expect(screen.getByText(legend)).toBeInTheDocument()
    }
  })

  it('needs the borough and both streets before it saves', async () => {
    const user = userEvent.setup()
    renderModal()
    expect(save()).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('Borough'), 'Queens')
    await user.type(screen.getByLabelText('North-south street'), '38th St')
    expect(save()).toBeDisabled()
    await user.type(screen.getByLabelText('East-west street'), '  ')
    expect(save()).toBeDisabled()
    await user.type(screen.getByLabelText('East-west street'), '31st Ave')
    expect(save()).toBeEnabled()
  })

  it('adds a corner with every field: text trimmed, none as null, a yes or no as a boolean, the ramp count a number', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal()
    await user.selectOptions(screen.getByLabelText('Borough'), 'Queens')
    await user.type(screen.getByLabelText('North-south street'), ' 38th St ')
    await user.type(screen.getByLabelText('East-west street'), '31st Ave')
    await user.selectOptions(screen.getByLabelText(/Corner type/), 'top_of_t')
    await user.selectOptions(screen.getByLabelText(/Number of ramps at corner/), '3')
    await user.selectOptions(screen.getByLabelText(/Painted roadway/), 'true')
    await user.click(save())
    const sent = onSave.mock.calls[0][0]
    expect(sent).toMatchObject({ boro: 'Queens', north_south_street: '38th St', east_west_street: '31st Ave',
      corner_type: 'top_of_t', number_of_ramps: 3, painted_roadway: true, t_intersection: null, comments: null })
    expect(Object.keys(sent)).toHaveLength(25) // every field the backend's corner has
  })

  it('edits only what changed, a field put back to none as null', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal({ mode: 'edit', initial: CORNER })
    expect(screen.getByLabelText(/Corner direction/)).toHaveValue('SW')
    expect(screen.getByLabelText(/T-intersection/)).toHaveValue('false')
    expect(save()).toBeDisabled()
    await user.selectOptions(screen.getByLabelText(/Corner direction/), '')
    await user.type(screen.getByLabelText(/Inspected by/), 'RG')
    await user.click(save())
    expect(onSave).toHaveBeenCalledWith({ corner_direction: null, inspected_by: 'RG' })
  })

  it('shows a 422 under the field it names', () => {
    const error = Object.assign(new Error('Unprocessable'), {
      status: 422, body: { detail: [{ loc: ['body', 'permit_number'], msg: 'permit_number can be at most 100 characters' }] },
    })
    renderModal({ mode: 'edit', initial: CORNER, error })
    expect(screen.getByLabelText(/Permit number/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('permit_number can be at most 100 characters')).toBeInTheDocument()
  })
})
