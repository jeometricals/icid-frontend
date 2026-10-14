import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PropertiesTable from '../PropertiesTable'

const ROW = {
  id: 'c0000000-0000-4000-8000-000000000001', project_id: 'HWS0023', bbl: '4001230045', address: '12 Main St',
  property_type: '1_3_family', notes: null, created_at: '2026-09-14T12:00:00', updated_at: '2026-09-14T12:00:00',
  created_by: 'a0000000-0000-4000-8000-000000000001', deleted_at: null, deleted_by: null,
}

function renderTable(props) {
  return render(
    <MemoryRouter>
      <PropertiesTable properties={[ROW]} renderActions={() => 'actions'} {...props} />
    </MemoryRouter>
  )
}

const headings = () => within(screen.getByRole('table')).getAllByRole('columnheader').map(th => th.textContent)

describe('PropertiesTable', () => {
  it('has no PIR column unless asked, as a task order\'s properties carry no pir_status', () => {
    renderTable()
    expect(headings()).toEqual(['BBL', 'Address', 'Type', 'Added', 'Actions'])
  })

  it('links each BBL to its page under its project', () => {
    renderTable()
    expect(screen.getByRole('link', { name: '4001230045' })).toHaveAttribute('href', `/project/HWS0023/properties/${ROW.id}`)
  })

  it('has no Actions column without renderActions, as for a demo user', () => {
    renderTable({ renderActions: undefined })
    expect(headings()).toEqual(['BBL', 'Address', 'Type', 'Added'])
  })

  it('shows each row\'s pir_status as a badge when asked', () => {
    renderTable({ properties: [{ ...ROW, pir_status: 'dot_signed' }], showPirStatus: true })
    expect(headings()).toEqual(['BBL', 'Address', 'Type', 'PIR', 'Added', 'Actions'])
    expect(within(screen.getAllByRole('cell')[3]).getByText('Signed by DOT')).toBeInTheDocument()
  })
})
