import { describe, it, expect } from 'vitest'
import { personName } from '../personName'

describe('personName', () => {
  it.each([
    ['first and last name', { first_name: 'Reza', last_name: 'Golestani', email: 'reza@icid.local' }, 'Reza Golestani'],
    ['first name only', { first_name: 'Reza', last_name: null, email: 'reza@icid.local' }, 'Reza'],
    ['last name only', { first_name: null, last_name: 'Golestani', email: 'reza@icid.local' }, 'Golestani'],
    ['the email when there is no name', { first_name: null, last_name: null, email: 'reza@icid.local' }, 'reza@icid.local'],
    ['the email when the names are empty strings', { first_name: '', last_name: '', email: 'reza@icid.local' }, 'reza@icid.local'],
    ['nothing when there is nothing to show', { first_name: null, last_name: null }, ''],
  ])('gives %s', (_, person, expected) => {
    expect(personName(person)).toBe(expected)
  })

  it('gives nothing for a missing person', () => {
    expect(personName(undefined)).toBe('')
    expect(personName(null)).toBe('')
  })
})
