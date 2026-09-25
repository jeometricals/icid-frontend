import { describe, it, expect } from 'vitest'
import { headerFormValues, changedHeaderFields, HEADER_FIELDS } from '../idrHeader'

const SERVER_IDR = {
  work_start_time: '07:00:00',
  work_end_time: '15:30:00',
  inspector_start_time: null,
  inspector_end_time: null,
  temp_low: null,
  temp_high: 78.0,
  weather_am: 'Clear',
  weather_pm: 'Partly cloudy',
  status: 'draft', // non-header fields are ignored
}

const SAVED = headerFormValues(SERVER_IDR)

describe('headerFormValues', () => {
  it('turns server values into input strings: null → "", HH:MM:SS → HH:MM, numbers → strings', () => {
    expect(SAVED).toEqual({
      work_start_time: '07:00',
      work_end_time: '15:30',
      inspector_start_time: '',
      inspector_end_time: '',
      temp_low: '',
      temp_high: '78',
      weather_am: 'Clear',
      weather_pm: 'Partly cloudy',
    })
  })

  it('returns exactly the 8 header fields', () => {
    expect(Object.keys(SAVED).sort()).toEqual([...HEADER_FIELDS].sort())
  })
})

describe('changedHeaderFields', () => {
  it('returns {} when nothing changed', () => {
    expect(changedHeaderFields({ ...SAVED }, SAVED)).toEqual({})
  })

  it('returns only the fields that differ', () => {
    expect(changedHeaderFields({ ...SAVED, inspector_start_time: '06:45', weather_am: 'Rainy' }, SAVED))
      .toEqual({ inspector_start_time: '06:45', weather_am: 'Rainy' })
  })

  it('sends a cleared field as null', () => {
    expect(changedHeaderFields({ ...SAVED, weather_pm: '', work_start_time: '' }, SAVED))
      .toEqual({ weather_pm: null, work_start_time: null })
  })

  it('sends temperatures as numbers', () => {
    expect(changedHeaderFields({ ...SAVED, temp_low: '48.5' }, SAVED)).toEqual({ temp_low: 48.5 })
  })

  it('treats "78.0" and "78" as the same temperature', () => {
    expect(changedHeaderFields({ ...SAVED, temp_high: '78.0' }, SAVED)).toEqual({})
  })

  it('counts a cleared temperature as a change', () => {
    expect(changedHeaderFields({ ...SAVED, temp_high: '' }, SAVED)).toEqual({ temp_high: null })
  })
})
