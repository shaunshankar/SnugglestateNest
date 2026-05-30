import { useState } from 'react'
import { Copy, Check, Home, Users, Crown } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../hooks/useHousehold'
import Layout from '../components/Layout'
import { PageLoader } from '../components/LoadingSpinner'
import { formatDate } from '../utils/formatters'
import toast from 'react-hot-toast'

export default function Household() {
  const { user } = useAuth()
  const { household, members, loading, isOwner } = useHousehold()
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(household.invite_code)
      setCopied(true)
      toast.success('Invite code copied!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  if (loading) return <Layout><PageLoader /></Layout>

  if (!household) {
    return (
      <Layout>
        <div className="card text-center py-12">
          <Home className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="text-slate-500">You're not in a household yet.</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="page-title">Household</h1>

        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center shrink-0">
              <Home className="w-6 h-6 text-teal-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-800">{household.name}</h2>
              <p className="text-sm text-slate-500 mt-0.5">Created {formatDate(household.created_at)}</p>
              {isOwner && <span className="inline-flex items-center gap-1 mt-2 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium"><Crown size={10} /> You're the owner</span>}
            </div>
          </div>
        </div>

        {/* Invite code */}
        <div className="card">
          <h2 className="section-title mb-1">Invite code</h2>
          <p className="text-sm text-slate-500 mb-4">Share this code with household members so they can join your Nest.</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-teal-50 border-2 border-dashed border-teal-200 rounded-xl px-6 py-4 text-center">
              <p className="text-3xl font-bold text-teal-700 tracking-[0.3em] font-mono">{household.invite_code}</p>
            </div>
            <button
              onClick={copyCode}
              className={`p-3 rounded-xl border-2 transition-all duration-200 ${copied ? 'border-emerald-400 bg-emerald-50 text-emerald-600' : 'border-stone-200 hover:border-teal-300 text-slate-500 hover:text-teal-600'}`}
            >
              {copied ? <Check size={20} /> : <Copy size={20} />}
            </button>
          </div>
        </div>

        {/* Members */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-slate-400" />
            <h2 className="section-title">{members.length} Member{members.length !== 1 ? 's' : ''}</h2>
          </div>
          <div className="space-y-3">
            {members.map(member => (
              <div key={member.id} className="flex items-center gap-3">
                <div className="w-9 h-9 bg-teal-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-teal-700">
                    {(member.full_name || member.email || '?').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800 truncate">{member.full_name || 'Unnamed'}</p>
                    {member.id === household.owner_id && (
                      <span className="inline-flex items-center gap-0.5 text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                        <Crown size={9} /> Owner
                      </span>
                    )}
                    {member.id === user?.id && (
                      <span className="text-xs text-slate-400 shrink-0">(you)</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{member.email}</p>
                </div>
                <p className="text-xs text-slate-400 shrink-0">Joined {formatDate(member.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
