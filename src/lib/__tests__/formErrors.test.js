import { describe, it, expect } from 'vitest'
import { formErrors } from '../formErrors'

const CONFLICT = { field: 'bbl', message: 'Taken.' }
const failure = (status, message, body = {}) => Object.assign(new Error(message), { status, body })

describe('formErrors', () => {
  it('has nothing to show without an error', () => {
    expect(formErrors(null, ['bbl'], CONFLICT)).toEqual({ fields: {}, general: null })
  })

  it('puts a 409 on the conflict field', () => {
    expect(formErrors(failure(409, 'x'), ['bbl'], CONFLICT)).toEqual({ fields: { bbl: 'Taken.' }, general: null })
  })

  it('puts a 422\'s messages on the fields their loc names, and the rest below', () => {
    const error = failure(422, 'x', { detail: [
      { loc: ['body', 'bbl'], msg: 'first' },
      { loc: ['body', 'bbl'], msg: 'second' },
      { loc: ['body', 'other'], msg: 'elsewhere' },
    ] })
    expect(formErrors(error, ['bbl'], CONFLICT)).toEqual({ fields: { bbl: 'first' }, general: 'second; elsewhere' })
  })

  it('says anything else as the backend worded it', () => {
    expect(formErrors(failure(400, 'bbl is too long'), ['bbl'], CONFLICT)).toEqual({ fields: {}, general: 'bbl is too long' })
  })
})

describe('formErrors — a 409 with no field', () => {
  it('says the conflict message below the form', () => {
    expect(formErrors(failure(409, 'x'), ['bbl'], { field: null, message: 'Taken.' }))
      .toEqual({ fields: {}, general: 'Taken.' })
  })
})
