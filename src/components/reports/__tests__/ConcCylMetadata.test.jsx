import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConcCylMetadata from '../ConcCylMetadata'
import { RedlineProvider } from '../../../contexts/RedlineContext'

const EMPTY = { dateOfDelivery: '', cyPoured: '', dateCast: '', jobLocation: '' }

function renderMetadata(props = {}) {
  const handlers = { onDeliveryCastingChange: vi.fn(), onFieldChange: vi.fn() }
  render(
    <ConcCylMetadata workDate="2026-09-27" deliveryCasting={EMPTY} sheetNo="" sheetOf="" placementLocation=""
      {...handlers} {...props} />
  )
  return handlers
}

describe('ConcCylMetadata', () => {
  it('renders two dates, a C.Y. number, a job location, Sheet No. / of and the placement location', () => {
    renderMetadata()
    expect(screen.getByRole('heading', { name: 'Delivery & Casting' })).toBeInTheDocument()
    expect(screen.getByLabelText('Date of Delivery')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('Date Cast')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('C.Y. Poured')).toHaveAttribute('type', 'number')
    expect(screen.getByLabelText('C.Y. Poured')).toHaveAttribute('step', '0.01')
    expect(screen.getByLabelText('Job Location')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Sheet No.')).toHaveValue('')
    expect(screen.getByLabelText('Sheet No. of')).toHaveValue('')
    expect(screen.getByLabelText('Specific Location of Placement')).toHaveValue('')
  })

  it("shows the work date's day of week", () => {
    renderMetadata() // 2026-09-27 is a Sunday
    expect(screen.getByText('Day of Week:').parentElement).toHaveTextContent('Day of Week: Sunday')
  })

  it('leaves the day of week out without a work date', () => {
    renderMetadata({ workDate: undefined })
    expect(screen.queryByText('Day of Week:')).not.toBeInTheDocument()
  })

  it('shows the saved values', () => {
    renderMetadata({
      deliveryCasting: { dateOfDelivery: '2026-09-26', cyPoured: '12.5', dateCast: '2026-09-27', jobLocation: 'Main St' },
      sheetNo: '1',
      sheetOf: '2',
      placementLocation: 'Pier 3',
    })
    expect(screen.getByLabelText('Date of Delivery')).toHaveValue('2026-09-26')
    expect(screen.getByLabelText('C.Y. Poured')).toHaveValue(12.5)
    expect(screen.getByLabelText('Date Cast')).toHaveValue('2026-09-27')
    expect(screen.getByLabelText('Job Location')).toHaveValue('Main St')
    expect(screen.getByLabelText('Sheet No.')).toHaveValue('1')
    expect(screen.getByLabelText('Sheet No. of')).toHaveValue('2')
    expect(screen.getByLabelText('Specific Location of Placement')).toHaveValue('Pier 3')
  })

  it('calls onDeliveryCastingChange(field, value) for the delivery and casting fields', async () => {
    const { onDeliveryCastingChange } = renderMetadata()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('C.Y. Poured'), '9')
    expect(onDeliveryCastingChange).toHaveBeenLastCalledWith('cyPoured', '9')
    await user.type(screen.getByLabelText('Date Cast'), '2026-09-27')
    expect(onDeliveryCastingChange).toHaveBeenLastCalledWith('dateCast', '2026-09-27')
  })

  it('calls onFieldChange(key, value) for Sheet No., of and the placement location', async () => {
    const { onFieldChange } = renderMetadata()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Sheet No.'), '1')
    expect(onFieldChange).toHaveBeenLastCalledWith('sheetNo', '1')
    await user.type(screen.getByLabelText('Sheet No. of'), '2')
    expect(onFieldChange).toHaveBeenLastCalledWith('sheetOf', '2')
    await user.type(screen.getByLabelText('Specific Location of Placement'), 'P')
    expect(onFieldChange).toHaveBeenLastCalledWith('placementLocation', 'P')
  })

  it('disables every field when disabled', () => {
    renderMetadata({ disabled: true })
    for (const label of ['Date of Delivery', 'C.Y. Poured', 'Date Cast', 'Job Location', 'Sheet No.', 'Sheet No. of',
      'Specific Location of Placement']) {
      expect(screen.getByLabelText(label)).toBeDisabled()
    }
  })
})

describe('ConcCylMetadata — reviewer edits', () => {
  const LABELS = ['Date of Delivery', 'C.Y. Poured', 'Date Cast', 'Job Location', 'Sheet No.', 'Sheet No. of',
    'Specific Location of Placement']
  const SAVED = {
    deliveryCasting: { dateOfDelivery: '2026-09-26', cyPoured: '12.5', dateCast: '2026-09-27', jobLocation: 'Main St' },
    sheetNo: '1',
    sheetOf: '2',
    placementLocation: 'Pier 3',
  }
  const editOf = (fieldPath, oldValue, newValue) => ({
    edit_id: `e-${fieldPath}`, report_id: 'rep-cyl', field_path: fieldPath, edit_type: 'field_change',
    old_value: oldValue, new_value: newValue, editor_initials: 'OE', editor_name: 'Olive Engineer',
  })

  // The section as it sits on a report page in review: read-only inputs inside a RedlineProvider
  function renderInReview(redline = {}) {
    const saveField = vi.fn().mockResolvedValue({ ok: true })
    render(
      <RedlineProvider value={{ reportId: 'rep-cyl', edits: [], isDraft: false, canEdit: false, saveField, ...redline }}>
        <ConcCylMetadata workDate="2026-09-27" {...SAVED} onDeliveryCastingChange={vi.fn()} onFieldChange={vi.fn()} disabled />
      </RedlineProvider>
    )
    return saveField
  }

  const pencils = () => screen.queryAllByRole('button', { name: /^Edit / })

  it('renders the inputs as before with edit mode off', () => {
    renderInReview()
    expect(pencils()).toHaveLength(0)
    expect(screen.queryByTestId('redline')).not.toBeInTheDocument()
    for (const label of LABELS) expect(screen.getByLabelText(label)).toBeDisabled()
    expect(screen.getByLabelText('C.Y. Poured')).toHaveValue(12.5)
  })

  it('gives every field a pencil in edit mode, and keeps its own input disabled', () => {
    renderInReview({ canEdit: true })
    expect(pencils().map(p => p.getAttribute('aria-label'))).toEqual(LABELS.map(label => `Edit ${label}`))
    for (const label of LABELS) expect(screen.getByLabelText(label)).toBeDisabled()
  })

  it.each([
    ['Date of Delivery', 'deliveryCasting.dateOfDelivery', 'date', '2026-09-26'],
    ['C.Y. Poured', 'deliveryCasting.cyPoured', 'number', '12.5'],
    ['Date Cast', 'deliveryCasting.dateCast', 'date', '2026-09-27'],
    ['Job Location', 'deliveryCasting.jobLocation', 'text', 'Main St'],
    ['Sheet No.', 'sheetNo', 'text', '1'],
    ['Sheet No. of', 'sheetOf', 'text', '2'],
  ])('opens %s on its value and saves it under %s', async (label, fieldPath, type, current) => {
    const saveField = renderInReview({ canEdit: true })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: `Edit ${label}` }))
    const input = screen.getByLabelText(`New value for ${label}`)
    expect(input).toHaveAttribute('type', type)
    expect(input).toHaveDisplayValue(current)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(saveField).toHaveBeenCalledWith(fieldPath, current)
  })

  it('saves a new C.Y. Poured under deliveryCasting.cyPoured', async () => {
    const saveField = renderInReview({ canEdit: true })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Edit C.Y. Poured' }))
    await user.clear(screen.getByLabelText('New value for C.Y. Poured'))
    await user.type(screen.getByLabelText('New value for C.Y. Poured'), '14')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(saveField).toHaveBeenCalledWith('deliveryCasting.cyPoured', '14')
  })

  it('edits the placement location in a textarea, under placementLocation', async () => {
    const saveField = renderInReview({ canEdit: true })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Edit Specific Location of Placement' }))
    const input = screen.getByLabelText('New value for Specific Location of Placement')
    expect(input.tagName).toBe('TEXTAREA')
    await user.type(input, ', east face')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(saveField).toHaveBeenCalledWith('placementLocation', 'Pier 3, east face')
  })

  it("draws a field's edits in its place: the original struck, the new value with initials", () => {
    renderInReview({
      edits: [editOf('deliveryCasting.cyPoured', '10', '12.5'), editOf('deliveryCasting.dateCast', '2026-09-26', '2026-09-27')],
    })
    expect(screen.getAllByTestId('redline').map(el => [...el.children].map(line => line.textContent)))
      .toEqual([['10', '12.5OE'], ['2026-09-26', '2026-09-27OE']])
    expect(screen.queryByLabelText('C.Y. Poured')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Job Location')).toHaveValue('Main St')
  })

  it('on a returned draft keeps the input live with the history under it', () => {
    renderInReview({ isDraft: true, edits: [editOf('sheetNo', '', '1')] })
    expect(screen.getByLabelText('Sheet No.')).toHaveValue('1')
    expect(screen.getByTestId('redline')).toHaveTextContent('1OE')
    expect(pencils()).toHaveLength(0)
  })
})
