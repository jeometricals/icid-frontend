import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import FlagProgressTable, { flagCount } from '../FlagProgressTable'
import { CONCRETE, SIDEWALK, progressItem } from '../../test/progress'

const cells = () => screen.getAllByRole('row').slice(1).map(tr => within(tr).getAllByRole('cell').map(td => td.textContent))

describe('FlagProgressTable', () => {
  it('has the three states, the live total and the percent as columns', () => {
    render(<FlagProgressTable payItems={[SIDEWALK]} label="Flags" />)
    expect(screen.getAllByRole('columnheader').map(th => th.textContent))
      .toEqual(['Pay Item', 'Description', 'Approved', 'In flight', 'Unclaimed', 'Live total', '%'])
  })

  it('prints the walkthrough: quantities to two decimals with their flag counts, empty states as a dash', () => {
    render(<FlagProgressTable payItems={[SIDEWALK, CONCRETE]} label="Flags" />)
    expect(screen.getByRole('table', { name: 'Flags' })).toBeInTheDocument()
    expect(cells()).toEqual([
      ['4.13 AAS (SF)SE384-CONS', '4.13 AAS description', '383.44(10 flags)', '—', '—', '383.44(10 flags)', '100.0%'],
      ['73.21AC (CY)SE384-CONS', '73.21AC description', '3.01(5 flags)', '—', '—', '3.01(5 flags)', '100.0%'],
    ])
  })

  it('splits a pay item across its states', () => {
    const item = progressItem('4.13 AAS', 'SF', 11.29, {
      approved: { quantity: 100, flag_count: 2, value: 1129 },
      in_flight: { quantity: 50.5, flag_count: 1, value: 570.15 },
      unclaimed: { quantity: 1240, flag_count: 6, value: 13999.6 },
    })
    render(<FlagProgressTable payItems={[item]} label="Flags" />)
    expect(cells()[0].slice(2)).toEqual(['100.00(2 flags)', '50.50(1 flag)', '1,240.00(6 flags)', '1,390.50(9 flags)', '7.2%'])
  })

  it('gives a dash for the percent of a pay item with nothing live', () => {
    render(<FlagProgressTable payItems={[progressItem('9.01', 'EA', 50)]} label="Flags" />)
    expect(cells()[0].slice(2)).toEqual(['—', '—', '—', '—', '—'])
  })
})

describe('flagCount', () => {
  it('counts one flag or several', () => {
    expect(flagCount(1)).toBe('1 flag')
    expect(flagCount(10)).toBe('10 flags')
  })

  it('counts segments for a pay item in LF, which curb segments fill', () => {
    expect(flagCount(1, 'LF')).toBe('1 segment')
    expect(flagCount(3, 'LF')).toBe('3 segments')
    expect(flagCount(3, 'SF')).toBe('3 flags')
  })
})
