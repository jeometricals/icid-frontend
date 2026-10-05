/**
 * The name to show for a person: first and last name, whichever of them is on file, else their email.
 * Takes anything with first_name, last_name and email (a signed-in user, or a listUsers row).
 * Returns the text, or '' when there is nothing to show.
 */
export function personName(person) {
  if (!person) return ''
  return [person.first_name, person.last_name].filter(Boolean).join(' ') || person.email || ''
}
