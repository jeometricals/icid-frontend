import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import IdrTable from '../IdrTable'

function idr(overrides) {
  return {
    idr_id: 'idr-1',
    project_id: 'HWS0023',
    report_date: '2026-10-04',
    status: 'approved',
    idr_number: 'SW-005',
    reporter_name: 'Genghis Khan',
    submitted_at: '2026-10-04T19:27:16Z',
    disciplines: ['Curb', 'Sidewalk'],
    ...overrides,
  }
}

const rows = () => screen.getAllByRole('row').slice(1)
const chips = row => within(row).queryAllByRole('listitem').map(chip => chip.textContent)

describe('IdrTable — disciplines', () => {
  it('lists each IDR\'s disciplines as chips with its number, in the order given, when asked to', () => {
    render(
      <IdrTable
        showDisciplines
        idrs={[
          idr(),
          idr({ idr_id: 'idr-2', idr_number: '006', disciplines: ['AC Pavement', 'Concrete (delivery)', 'General'] }),
        ]}
      />
    )
    const [first, second] = rows()
    expect(chips(first)).toEqual(['Curb', 'Sidewalk'])
    expect(chips(second)).toEqual(['AC Pavement', 'Concrete (delivery)', 'General'])
    const numberCell = within(first).getByText('SW-005').closest('td')
    expect(within(numberCell).getByRole('list', { name: 'Disciplines' })).toBeInTheDocument()
  })

  it('shows none for an IDR with no reports, or a row that carries no disciplines', () => {
    render(
      <IdrTable showDisciplines idrs={[idr({ disciplines: [] }), idr({ idr_id: 'idr-2', disciplines: undefined })]} />
    )
    for (const row of rows()) expect(within(row).queryByRole('list')).not.toBeInTheDocument()
  })

  it('leaves them out unless asked, as on the review queue and the admin list', () => {
    render(<IdrTable idrs={[idr()]} />)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(rows()[0]).not.toHaveTextContent('Sidewalk')
  })
})
