import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PirStatusBadge from '../PirStatusBadge'
import { pirStatus, pirStatusFromApi } from '../../lib/pirs'

const PIR = { id: 'p1', inspector_initials: 'JD', inspector_sign_date: '2026-09-14', as_built_signed_at: null }

describe('PirStatusBadge', () => {
  it.each([
    ['no PIR', null, 'none', '—'],
    ['a PIR the DOT inspector signed', PIR, 'dotSigned', 'Signed by DOT'],
    ['a PIR with the as-built signed', { ...PIR, as_built_signed_at: '2026-10-01T12:00:00Z' }, 'asBuiltSigned', 'As-built signed'],
  ])('reads %s', (_, pir, status, label) => {
    expect(pirStatus(pir)).toBe(status)
    render(<PirStatusBadge pir={pir} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it.each([
    ['none', 'none', '—'],
    ['dot_signed', 'dotSigned', 'Signed by DOT'],
    ['as_built_signed', 'asBuiltSigned', 'As-built signed'],
    [undefined, 'none', '—'],
  ])("reads the property list's pir_status %s", (value, status, label) => {
    expect(pirStatusFromApi(value)).toBe(status)
    render(<PirStatusBadge status={pirStatusFromApi(value)} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('takes a given status over the PIR', () => {
    render(<PirStatusBadge pir={null} status="asBuiltSigned" />)
    expect(screen.getByText('As-built signed')).toBeInTheDocument()
  })
})
