import { format, isSameYear, parseISO } from 'date-fns'

/**
 * A date as the admin tables print it: "Sep 14", with the year when it isn't this one ("Sep 14, 2024").
 * Takes a timestamp or a 'YYYY-MM-DD' date (read as that day on the viewer's calendar) and, for tests, today.
 */
export function shortDate(value, today = new Date()) {
  const date = parseISO(value)
  return format(date, isSameYear(date, today) ? 'MMM d' : 'MMM d, yyyy')
}
