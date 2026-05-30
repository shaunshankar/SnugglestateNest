import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bird, Home, Users } from 'lucide-react'
import { useHousehold } from '../hooks/useHousehold'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

export default function HouseholdSetup() {
  const [mode, setMode] = useState(null)
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const { createHousehold, joinHousehold } = useHousehold()
  const { refreshProfile } = useAuth()
  const navigate = useNavigate()

  async function handleCreate(e) {
    e.preventDefault()
    if (!householdName.trim()) return
    setLoading(true)
    try {
      await createHousehold(householdName.trim())
      await refreshProfile()
      toast.success('Household created!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.message || 'Failed to create household')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!inviteCode.trim()) return
    setLoading(true)
    try {
      await joinHousehold(inviteCode.trim())
      await refreshProfile()
      toast.success('Joined household!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.message || 'Invalid invite code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-stone-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-600 rounded-2xl mb-4">
            <Bird className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Set up your Nest</h1>
          <p className="text-slate-500 mt-1">Create a household or join an existing one</p>
        </div>

        {!mode ? (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setMode('create')}
              className="bg-white rounded-2xl border-2 border-stone-100 hover:border-teal-400 p-6 text-center transition-all duration-150 group"
            >
              <div className="w-12 h-12 bg-teal-50 group-hover:bg-teal-100 rounded-xl flex items-center justify-center mx-auto mb-3 transition-colors">
                <Home className="w-6 h-6 text-teal-600" />
              </div>
              <p className="font-semibold text-slate-800">Create</p>
              <p className="text-xs text-slate-500 mt-1">Start a new household</p>
            </button>
            <button
              onClick={() => setMode('join')}
              className="bg-white rounded-2xl border-2 border-stone-100 hover:border-teal-400 p-6 text-center transition-all duration-150 group"
            >
              <div className="w-12 h-12 bg-teal-50 group-hover:bg-teal-100 rounded-xl flex items-center justify-center mx-auto mb-3 transition-colors">
                <Users className="w-6 h-6 text-teal-600" />
              </div>
              <p className="font-semibold text-slate-800">Join</p>
              <p className="text-xs text-slate-500 mt-1">Use an invite code</p>
            </button>
          </div>
        ) : mode === 'create' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-8">
            <button onClick={() => setMode(null)} className="text-sm text-slate-500 hover:text-slate-700 mb-4 inline-block">
              ← Back
            </button>
            <h2 className="text-xl font-semibold text-slate-800 mb-6">Create a household</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Household name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. The Smith Household"
                  value={householdName}
                  onChange={e => setHouseholdName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Creating…' : 'Create household'}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-8">
            <button onClick={() => setMode(null)} className="text-sm text-slate-500 hover:text-slate-700 mb-4 inline-block">
              ← Back
            </button>
            <h2 className="text-xl font-semibold text-slate-800 mb-6">Join a household</h2>
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="label">Invite code</label>
                <input
                  type="text"
                  className="input uppercase tracking-widest font-mono"
                  placeholder="ABC123"
                  maxLength={6}
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  required
                  autoFocus
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Joining…' : 'Join household'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
