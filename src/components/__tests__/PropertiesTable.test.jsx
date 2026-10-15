import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PropertiesTable from '../PropertiesTable'

const ROW = {
  id: 'c0000000-0000-4000-8000-000000000001', project_id: 'HWS0023', kind: 'sidewalk', bbl: '4001230045',
  address: '12 Main St', display_address: '12 Main St', property_type: '1_3_family', notes: null,
  created_at: '2026-09-14T12:00:00', updated_at: '2026-09-14T12:00:00',
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
  it('lists BBL, address, type and added', () => {
    renderTable()
    expect(headings()).toEqual(['BBL', 'Address', 'Type', 'Added', 'Actions'])
    expect(screen.getAllByRole('cell').slice(0, 3).map(td => td.textContent)).toEqual(['4001230045', '12 Main St', '1-3 family'])
  })

  it('links each BBL to its page under its project', () => {
    renderTable()
    expect(screen.getByRole('link', { name: '4001230045' })).toHaveAttribute('href', `/project/HWS0023/properties/${ROW.id}`)
  })

  it('has no Actions column without renderActions, as for a demo user', () => {
    renderTable({ renderActions: undefined })
    expect(headings()).toEqual(['BBL', 'Address', 'Type', 'Added'])
  })

  it('shows a ped ramp by its intersection and ramp type, its link reading "Ped ramp"', () => {
    renderTable({ properties: [{
      ...ROW, kind: 'ped_ramp', bbl: null, address: null, property_type: null, ramp_type: 'PARALLEL',
      display_address: 'Atlantic Ave & Court St — NE Quadrant (Facing Court St)',
    }] })
    expect(screen.getByRole('link', { name: 'Ped ramp' })).toHaveAttribute('href', `/project/HWS0023/properties/${ROW.id}`)
    expect(screen.getAllByRole('cell').slice(1, 3).map(td => td.textContent))
      .toEqual(['Atlantic Ave & Court St — NE Quadrant (Facing Court St)', 'Parallel'])
  })
})
