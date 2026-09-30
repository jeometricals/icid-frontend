import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ACRequirementsChecklist from '../ACRequirementsChecklist'

const ITEM_LABELS = [
  'Subgrade Compacted per Spec or Approved Alternative',
  'Roadway Subgrade/Base Surface Sufficiently Clean and Dry',
  'A/C Roller as per Spec or Approved Plan',
  'Density Tests Taken',
  'Spot Check A/C Depth',
  'Tack Coat Applied as per Spec',
  'Tack Coat Applied on All Edges of Hardware',
]

function renderChecklist(props = {}) {
  const onChange = vi.fn()
  render(<ACRequirementsChecklist value={{}} onChange={onChange} {...props} />)
  return onChange
}

// Holds the checklist in state so clicks re-render, as the page does
function StatefulChecklist() {
  const [value, setValue] = useState({})
  return <ACRequirementsChecklist value={value} onChange={setValue} />
}

const radio = (name) => screen.getByRole('radio', { name })

describe('ACRequirementsChecklist', () => {
  it('renders the seven AC items, each with unanswered Y / N / N/A radios and an empty Remarks input', () => {
    renderChecklist()
    expect(screen.getByRole('heading', { name: 'AC Requirements Checklist' })).toBeInTheDocument()
    for (const label of ITEM_LABELS) {
      for (const option of ['Y', 'N', 'N/A']) expect(radio(`${label}: ${option}`)).not.toBeChecked()
      expect(screen.getByLabelText(`${label} Remarks`)).toHaveValue('')
    }
    expect(screen.getAllByRole('radio')).toHaveLength(21)
  })

  it('shows the saved answers and remarks', () => {
    renderChecklist({
      value: {
        densityTestsTaken: { value: 'Y', remarks: '3 cores' },
        tackCoatOnEdges: { value: 'NA', remarks: '' },
      },
    })
    expect(radio('Density Tests Taken: Y')).toBeChecked()
    expect(screen.getByLabelText('Density Tests Taken Remarks')).toHaveValue('3 cores')
    expect(radio('Tack Coat Applied on All Edges of Hardware: N/A')).toBeChecked()
    expect(radio('Spot Check A/C Depth: Y')).not.toBeChecked()
  })

  it('calls onChange with the whole object, updating only the touched item', async () => {
    const saved = { densityTestsTaken: { value: 'Y', remarks: '3 cores' } }
    const onChange = renderChecklist({ value: saved })
    const user = userEvent.setup()
    await user.click(radio('Spot Check A/C Depth: N'))
    expect(onChange).toHaveBeenLastCalledWith({ ...saved, spotCheckAcDepth: { value: 'N' } })
    await user.type(screen.getByLabelText('Density Tests Taken Remarks'), 'x')
    expect(onChange).toHaveBeenLastCalledWith({ densityTestsTaken: { value: 'Y', remarks: '3 coresx' } })
  })

  it("keeps each item's answer independent", async () => {
    render(<StatefulChecklist />)
    const user = userEvent.setup()
    await user.click(radio('Density Tests Taken: Y'))
    await user.click(radio('Tack Coat Applied as per Spec: N'))
    await user.click(radio('Density Tests Taken: N/A'))
    expect(radio('Density Tests Taken: N/A')).toBeChecked()
    expect(radio('Density Tests Taken: Y')).not.toBeChecked()
    expect(radio('Tack Coat Applied as per Spec: N')).toBeChecked()
  })

  it('disables every radio and remarks input when disabled', () => {
    renderChecklist({ disabled: true })
    for (const input of [...screen.getAllByRole('radio'), ...screen.getAllByRole('textbox')]) {
      expect(input).toBeDisabled()
    }
  })
})
