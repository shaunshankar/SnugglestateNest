import { createContext, useContext, useEffect, useState } from 'react'
import { authClient, client } from '../lib/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const { data: sessionData, isPending } = authClient.useSession()
  const user = sessionData?.user ?? null
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    if (isPending) return
    if (!user) {
      setProfile(null)
      setProfileLoading(false)
      return
    }
    setProfileLoading(true)
    client.from('profiles').select('*').eq('id', user.id).single()
      .then(async ({ data }) => {
        if (data) {
          setProfile(data)
        } else {
          await client.from('profiles').insert({
            id: user.id,
            email: user.email,
            full_name: user.name ?? '',
          })
          const { data: fresh } = await client.from('profiles').select('*').eq('id', user.id).single()
          setProfile(fresh ?? null)
        }
      })
      .finally(() => setProfileLoading(false))
  }, [user?.id, isPending])

  const loading = isPending || profileLoading

  async function signUp(email, password, fullName) {
    const result = await authClient.signUp.email({ email, password, name: fullName })
    if (result?.error) throw result.error
    return result?.data
  }

  async function signIn(email, password) {
    const result = await authClient.signIn.email({ email, password })
    if (result?.error) throw result.error
    return result?.data
  }

  async function signOut() {
    await authClient.signOut()
    setProfile(null)
  }

  async function refreshProfile() {
    if (user) {
      setProfileLoading(true)
      const { data } = await client.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data ?? null)
      setProfileLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
