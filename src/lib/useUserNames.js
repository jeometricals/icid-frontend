import { useCallback, useEffect, useState } from 'react'
import { listAdminUsers } from '../services/api'
import { personName } from './personName'

/**
 * Names the users an admin page mentions by id ("Created by", "Digitized by"): reads every user, deleted ones
 * included, once. A name is a nicety: until the list is in, when it can't be read, or when it doesn't have the
 * user, the name is null and the page says the date alone, as the IDR page's signed banner does.
 * Takes whether to read at all (false for anyone who isn't an admin).
 * Returns nameOf(uuid): the user's name, or null.
 */
export function useUserNames(enabled) {
  const [users, setUsers] = useState([])

  useEffect(() => {
    if (!enabled) return
    let ignore = false
    listAdminUsers({ include_deleted: true })
      .then(found => { if (!ignore) setUsers(found) })
      .catch(() => { if (!ignore) setUsers([]) })
    return () => { ignore = true }
  }, [enabled])

  return useCallback(
    (uuid) => (uuid ? personName(users.find(found => found.uuid === uuid)) || null : null),
    [users],
  )
}
