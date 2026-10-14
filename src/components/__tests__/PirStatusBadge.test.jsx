import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PirStatusBadge from '../PirStatusBadge'
import { pirStatus } from '../../lib/pirs'

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
})
