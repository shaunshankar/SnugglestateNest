import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { dbFetch } from '../lib/db'
import { useAuth } from './useAuth'

const HouseholdContext = createContext(null)

export function HouseholdProvider({ children }) {
  const { user, profile } = useAuth()
  const [household, setHousehold] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchHousehold = useCallback(async () => {
    if (!profile?.household_id) {
      setHousehold(null)
      setMembers([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [hhRows, memRows] = await Promise.all([
        dbFetch('SELECT * FROM households WHERE id = $1', [profile.household_id]),
        dbFetch('SELECT * FROM profiles WHERE household_id = $1', [profile.household_id]),
      ])
      setHousehold(hhRows[0] ?? null)
      setMembers(memRows)
    } finally {
      setLoading(false)
    }
  }, [profile?.household_id])

  useEffect(() => {
    fetchHousehold()
  }, [fetchHousehold])

  const isOwner = household && user && household.owner_id === user.id

  async function createHousehold(name) {
    const rows = await dbFetch('SELECT create_household($1)', [name])
    await fetchHousehold()
    return rows[0]
  }

  async function joinHousehold(inviteCode) {
    const rows = await dbFetch('SELECT join_household_by_invite($1)', [inviteCode])
    await fetchHousehold()
    return rows[0]
  }

  return (
    <HouseholdContext.Provider value={{ household, members, loading, isOwner, fetchHousehold, createHousehold, joinHousehold }}>
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider')
  return ctx
}
