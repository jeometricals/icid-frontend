import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import UnmappedFlagsNote from '../UnmappedFlagsNote'
import { ELM_ST, MAIN_ST } from '../../test/progress'

const renderNote = (entries) => render(
  <MemoryRouter><UnmappedFlagsNote projectId="SE384" entries={entries} /></MemoryRouter>
)

describe('UnmappedFlagsNote', () => {
  it("links each site with unmapped flags to its PIR page", () => {
    renderNote([
      { property_id: ELM_ST, display_address: '350 Main St', flag_count: 3 },
      { property_id: MAIN_ST, display_address: '138-22 227 Street', flag_count: 1 },
    ])
    expect(screen.getByRole('link', { name: '3 unmapped flags on 350 Main St' }))
      .toHaveAttribute('href', `/project/SE384/properties/${ELM_ST}/pir`)
    expect(screen.getByRole('link', { name: '1 unmapped flag on 138-22 227 Street' }))
      .toHaveAttribute('href', `/project/SE384/properties/${MAIN_ST}/pir`)
  })

  it('shows nothing when there are none', () => {
    renderNote([])
    expect(screen.queryByRole('list', { name: 'Unmapped flags' })).not.toBeInTheDocument()
  })
})
