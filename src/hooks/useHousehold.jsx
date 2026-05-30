import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { client } from '../lib/auth'
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
      const [{ data: hh }, { data: mems }] = await Promise.all([
        client.from('households').select('*').eq('id', profile.household_id).single(),
        client.from('profiles').select('*').eq('household_id', profile.household_id),
      ])
      setHousehold(hh ?? null)
      setMembers(mems || [])
    } finally {
      setLoading(false)
    }
  }, [profile?.household_id])

  useEffect(() => {
    fetchHousehold()
  }, [fetchHousehold])

  const isOwner = household && user && household.owner_id === user.id

  async function createHousehold(name) {
    const { data, error } = await client.rpc('create_household', { household_name: name })
    if (error) throw error
    await fetchHousehold()
    return data
  }

  async function joinHousehold(inviteCode) {
    const { data, error } = await client.rpc('join_household_by_invite', { invite_code_input: inviteCode })
    if (error) throw error
    await fetchHousehold()
    return data
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
