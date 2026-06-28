import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import type { User } from '../types.js'

const STORAGE_KEY = 'konditorei:activeUserId'

export function useActiveUser() {
  const [users, setUsers] = useState<User[]>([])
  const [activeUser, setActiveUserState] = useState<User | null>(null)

  useEffect(() => {
    api.users.list().then((all) => {
      setUsers(all)
      const storedId = Number(localStorage.getItem(STORAGE_KEY))
      const found = all.find((u) => u.id === storedId) ?? all[0] ?? null
      setActiveUserState(found)
    }).catch(() => { setUsers([]); setActiveUserState(null) })
  }, [])

  function setActiveUser(user: User) {
    localStorage.setItem(STORAGE_KEY, String(user.id))
    setActiveUserState(user)
  }

  async function createUser(name: string): Promise<User> {
    const user = await api.users.create(name)
    setUsers((prev) => [...prev, user])
    setActiveUser(user)
    return user
  }

  return { users, activeUser, setActiveUser, createUser }
}
