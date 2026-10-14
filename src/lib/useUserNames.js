import { useCallback, useEffect, useState } from 'react'
import { listAdminUsers, listUsers } from '../services/api'
import { isAdmin } from './reviewRoles'
import { personName } from './personName'

// Who a user list's row is: the admin list says uuid, the members' list user_id
const idOf = (row) => row.uuid ?? row.user_id

/**
 * Names the users a page mentions by id ("Created by", "Digitized by"). For an admin it reads every user, deleted
 * ones included (GET /v1/admin/users); for anyone else the members' list (GET /v1/users/); a demo user, whom the
 * backend gives neither, reads nothing. A name is a nicety: until the list is in, when it can't be read, or when
 * it doesn't have the user, the name is null and the page says the date alone, as the IDR page's signed banner does.
 * Takes the signed-in user (or null, to read nothing).
 * Returns nameOf(uuid): the user's name, or null.
 */
export function useUserNames(user) {
  const [users, setUsers] = useState([])
  const source = !user || user.is_demo ? null : isAdmin(user) ? 'admin' : 'members'

  useEffect(() => {
    if (!source) return
    let ignore = false
    const read = source === 'admin' ? listAdminUsers({ include_deleted: true }) : listUsers()
    read
      .then(found => { if (!ignore) setUsers(found) })
      .catch(() => { if (!ignore) setUsers([]) })
    return () => { ignore = true }
  }, [source])

  return useCallback(
    (uuid) => (uuid ? personName(users.find(found => idOf(found) === uuid)) || null : null),
    [users],
  )
}
