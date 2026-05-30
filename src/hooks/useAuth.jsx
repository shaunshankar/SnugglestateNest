import { createContext, useContext, useEffect, useState } from 'react'
import { authClient } from '../lib/auth'
import { dbFetch } from '../lib/db'

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
    dbFetch('SELECT * FROM profiles WHERE id = $1', [user.id])
      .then(rows => setProfile(rows[0] ?? null))
      .finally(() => setProfileLoading(false))
  }, [user?.id, isPending])

  const loading = isPending || profileLoading

  async function signUp(email, password, fullName) {
    const result = await authClient.signUp.email({ email, password, name: fullName })
    if (result?.error) throw result.error
    const newUser = result?.data?.user
    if (newUser?.id) {
      await dbFetch(
        'INSERT INTO profiles (id, email, full_name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [newUser.id, email, fullName]
      )
    }
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
      const rows = await dbFetch('SELECT * FROM profiles WHERE id = $1', [user.id])
      setProfile(rows[0] ?? null)
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
