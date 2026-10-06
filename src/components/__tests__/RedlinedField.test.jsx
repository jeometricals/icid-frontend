import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RedlinedField from '../RedlinedField'
import { RedlineProvider } from '../../contexts/RedlineContext'

const REPORT = 'rep-1'

function edit(n, oldValue, newValue, initials, overrides = {}) {
  return {
    edit_id: `edit-${n}`, report_id: REPORT, field_path: 'workforce.foremen', edit_type: 'field_change',
    old_value: oldValue, new_value: newValue, editor_initials: initials, editor_name: `Editor ${initials}`,
    editor_stage: 'stage1', edited_at: `2026-10-06T15:0${n}:00Z`, ...overrides,
  }
}

let saveField

// The field as a section renders it: the wrapped control is the section's own (disabled) input
function renderField({ value = '2', edits = [], canEdit = false, isDraft = false, provider = true, ...props } = {}) {
  const field = (
    <RedlinedField path="workforce.foremen" value={value} label="Foremen" {...props}>
      <input aria-label="Foremen" value={value} disabled={!isDraft} onChange={() => {}} />
    </RedlinedField>
  )
  if (!provider) return render(field)
  return render(
    <RedlineProvider value={{ reportId: REPORT, edits, isDraft, canEdit, saveField }}>{field}</RedlineProvider>
  )
}

const redline = () => screen.queryByTestId('redline')
const lines = () => [...redline().children].map(el => el.textContent)
const pencil = () => screen.queryByRole('button', { name: 'Edit Foremen' })

beforeEach(() => {
  saveField = vi.fn().mockResolvedValue({ ok: true })
})

describe('RedlinedField — with nothing to show', () => {
  it('renders just the control it wraps outside a provider', () => {
    renderField({ provider: false })
    expect(screen.getByLabelText('Foremen')).toHaveValue('2')
    expect(redline()).not.toBeInTheDocument()
    expect(pencil()).not.toBeInTheDocument()
  })

  it('renders just the control for a field nobody edited, with edit mode off', () => {
    renderField()
    expect(screen.getByLabelText('Foremen')).toBeDisabled()
    expect(redline()).not.toBeInTheDocument()
    expect(pencil()).not.toBeInTheDocument()
  })

  it("ignores another field's edits, and the same path on another report", () => {
    renderField({ edits: [
      edit(1, '1', '4', 'OE', { field_path: 'workforce.laborers' }),
      edit(2, '2', '9', 'OE', { report_id: 'rep-2' }),
      edit(3, '2', '9', 'OE', { report_id: null }),
    ] })
    expect(redline()).not.toBeInTheDocument()
  })
})

describe('RedlinedField — the redline', () => {
  it('shows the original struck through with no initials, then the edit in blue with its initials', () => {
    renderField({ value: '3', edits: [edit(1, '2', '3', 'OE')] })
    expect(lines()).toEqual(['2', '3OE'])
    const [original, edited] = redline().children
    expect(original).toHaveClass('line-through')
    expect(edited).toHaveClass('text-[#0070C0]')
    expect(within(edited).getByText('OE')).toHaveAttribute('title', 'Editor OE')
    expect(screen.queryByLabelText('Foremen')).not.toBeInTheDocument() // the redline stands in for the input
  })

  it('stacks a chain of edits oldest first, each with its own initials', () => {
    renderField({ value: '5', edits: [edit(1, '2', '3', 'OE'), edit(2, '3', '4', 'RR'), edit(3, '4', '5', 'MK')] })
    expect(lines()).toEqual(['2', '3OE', '4RR', '5MK'])
    expect(redline().querySelectorAll('.line-through')).toHaveLength(1) // only the original is struck
  })

  it('reads a blank original or a cleared value as "(blank)", and true / false as Yes / No', () => {
    const { unmount } = renderField({ value: 'Y', edits: [edit(1, null, 'Y', 'OE')] })
    expect(lines()).toEqual(['(blank)', 'YOE'])
    unmount()
    renderField({ value: false, edits: [edit(1, true, false, 'OE')] })
    expect(lines()).toEqual(['Yes', 'NoOE'])
  })

  it('shows values through the format it is given', () => {
    renderField({ value: '07:30', edits: [edit(1, '07:00:00', '07:30:00', 'OE')], format: v => (v ? String(v).slice(0, 5) : v) })
    expect(lines()).toEqual(['07:00', '07:30OE'])
  })

  it('leaves out the badge for an editor with no initials', () => {
    renderField({ value: '3', edits: [edit(1, '2', '3', '')] })
    expect(lines()).toEqual(['2', '3'])
  })
})

describe('RedlinedField — inspector revised after return', () => {
  it('adds the current value with the note when it differs from the last edit', () => {
    renderField({ value: '6', edits: [edit(1, '2', '3', 'OE')] })
    expect(lines()).toEqual(['2', '3OE', '6Inspector revised after return'])
    const note = screen.getByText('Inspector revised after return')
    expect(note).toHaveClass('text-[11px]', 'text-gray-500')
    expect(within(redline().lastChild).queryByText('OE')).not.toBeInTheDocument() // no initials: nobody logged it
  })

  it('says nothing when the current value is the last edit', () => {
    renderField({ value: '3', edits: [edit(1, '2', '3', 'OE')] })
    expect(screen.queryByText('Inspector revised after return')).not.toBeInTheDocument()
  })

  it('compares numbers as numbers and times through the format', () => {
    const { unmount } = renderField({ value: '80', edits: [edit(1, 74.5, 80.0, 'OE')] })
    expect(screen.queryByText('Inspector revised after return')).not.toBeInTheDocument()
    unmount()
    renderField({ value: '07:30', edits: [edit(1, '07:00:00', '07:30:00', 'OE')], format: v => (v ? String(v).slice(0, 5) : v) })
    expect(screen.queryByText('Inspector revised after return')).not.toBeInTheDocument()
  })
})

describe('RedlinedField — on a draft', () => {
  it('keeps the live input and reads the history under it', () => {
    renderField({ value: '6', isDraft: true, edits: [edit(1, '2', '3', 'OE')] })
    expect(screen.getByLabelText('Foremen')).toBeEnabled()
    expect(lines()).toEqual(['2', '3OE', '6Inspector revised after return'])
  })

  it('never offers the pencil, even with edit mode somehow on', () => {
    renderField({ isDraft: true, canEdit: true })
    expect(pencil()).not.toBeInTheDocument()
  })
})

describe('RedlinedField — editing', () => {
  it('shows no pencil with edit mode off, redline or not', () => {
    renderField({ value: '3', edits: [edit(1, '2', '3', 'OE')] })
    expect(pencil()).not.toBeInTheDocument()
  })

  it('shows a pencil in edit mode, hidden until the field is hovered or focused', () => {
    renderField({ canEdit: true })
    expect(pencil()).toHaveClass('opacity-0', 'group-hover:opacity-100', 'focus:opacity-100')
    expect(screen.getByLabelText('Foremen')).toBeInTheDocument() // the control still shows
  })

  it('opens an inline input holding the current value, with Save and Cancel', async () => {
    const user = userEvent.setup()
    renderField({ canEdit: true, type: 'number' })
    await user.click(pencil())
    const input = screen.getByLabelText('New value for Foremen')
    expect(input).toHaveValue(2)
    expect(input).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(pencil()).not.toBeInTheDocument()
  })

  it('saves the typed value for its path and closes', async () => {
    const user = userEvent.setup()
    renderField({ canEdit: true })
    await user.click(pencil())
    await user.clear(screen.getByLabelText('New value for Foremen'))
    await user.type(screen.getByLabelText('New value for Foremen'), '3')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(saveField).toHaveBeenCalledWith('workforce.foremen', '3')
    expect(screen.queryByLabelText('New value for Foremen')).not.toBeInTheDocument()
    expect(pencil()).toBeInTheDocument()
  })

  it('sends the value through toRequest', async () => {
    const user = userEvent.setup()
    renderField({ canEdit: true, value: '74.5', type: 'number', toRequest: t => (t === '' ? null : Number(t)) })
    await user.click(pencil())
    await user.clear(screen.getByLabelText('New value for Foremen'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(saveField).toHaveBeenCalledWith('workforce.foremen', null)
  })

  it('changes nothing on Cancel', async () => {
    const user = userEvent.setup()
    renderField({ canEdit: true })
    await user.click(pencil())
    await user.type(screen.getByLabelText('New value for Foremen'), '9')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(saveField).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Foremen')).toHaveValue('2')
  })

  it('keeps the input open with the reason when the save is refused', async () => {
    saveField.mockResolvedValue({ ok: false, message: 'The field already holds that value' })
    const user = userEvent.setup()
    renderField({ canEdit: true })
    await user.click(pencil())
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The field already holds that value')
    expect(screen.getByLabelText('New value for Foremen')).toHaveValue('2')
  })

  it('closes without an error on a conflict: the page has reloaded and shown its own notice', async () => {
    saveField.mockResolvedValue({ ok: false, conflict: true })
    const user = userEvent.setup()
    renderField({ canEdit: true })
    await user.click(pencil())
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByLabelText('New value for Foremen')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('edits a field that already has a redline, starting from its current value', async () => {
    const user = userEvent.setup()
    renderField({ value: '3', canEdit: true, edits: [edit(1, '2', '3', 'OE')] })
    await user.click(pencil())
    expect(screen.getByLabelText('New value for Foremen')).toHaveValue('3')
  })

  it('offers a select for a field with a fixed set of answers, blank included', async () => {
    const user = userEvent.setup()
    const options = [{ value: 'Y', label: 'Y' }, { value: 'N', label: 'N' }, { value: 'NA', label: 'N/A' }]
    renderField({ value: 'Y', canEdit: true, type: 'select', options })
    await user.click(pencil())
    const select = screen.getByLabelText('New value for Foremen')
    expect(within(select).getAllByRole('option').map(o => o.textContent)).toEqual(['(blank)', 'Y', 'N', 'N/A'])
    await user.selectOptions(select, 'NA')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(saveField).toHaveBeenCalledWith('workforce.foremen', 'NA')
  })

  it('offers a textarea for long text', async () => {
    const user = userEvent.setup()
    renderField({ value: 'Poured curb', canEdit: true, type: 'textarea' })
    await user.click(pencil())
    expect(screen.getByLabelText('New value for Foremen').tagName).toBe('TEXTAREA')
  })
})
