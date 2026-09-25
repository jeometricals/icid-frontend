import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import IdrHeaderForm from '../IdrHeaderForm'

const VALUES = {
  work_start_time: '07:00',
  work_end_time: '15:30',
  inspector_start_time: '',
  inspector_end_time: '',
  temp_low: '',
  temp_high: '78',
  weather_am: 'Clear',
  weather_pm: '',
}

describe('IdrHeaderForm', () => {
  it('shows all 8 header fields with their values', () => {
    render(<IdrHeaderForm values={VALUES} onChange={() => {}} />)
    expect(screen.getByLabelText('Work Activity Start')).toHaveValue('07:00')
    expect(screen.getByLabelText('Work Activity End')).toHaveValue('15:30')
    expect(screen.getByLabelText('Inspector Time Start')).toHaveValue('')
    expect(screen.getByLabelText('Inspector Time End')).toHaveValue('')
    expect(screen.getByLabelText('Daily Temp Low (°F)')).toHaveValue(null)
    expect(screen.getByLabelText('Daily Temp High (°F)')).toHaveValue(78)
    expect(screen.getByLabelText('Weather AM')).toHaveValue('Clear')
    expect(screen.getByLabelText('Weather PM')).toHaveValue('')
  })

  it('reports edits as (field, value)', () => {
    const onChange = vi.fn()
    render(<IdrHeaderForm values={VALUES} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Daily Temp Low (°F)'), { target: { value: '48' } })
    fireEvent.change(screen.getByLabelText('Weather PM'), { target: { value: 'Rainy' } })
    expect(onChange).toHaveBeenCalledWith('temp_low', '48')
    expect(onChange).toHaveBeenCalledWith('weather_pm', 'Rainy')
  })

  it('keeps a saved weather value that is not in the standard list', () => {
    render(<IdrHeaderForm values={{ ...VALUES, weather_pm: 'Partly cloudy' }} onChange={() => {}} />)
    expect(screen.getByLabelText('Weather PM')).toHaveValue('Partly cloudy')
    expect(screen.getAllByRole('option', { name: 'Partly cloudy' })).toHaveLength(1)
  })
})
