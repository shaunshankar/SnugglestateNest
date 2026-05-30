import { useEffect, useState } from 'react'
import { Plus, PiggyBank, Target, TrendingUp } from 'lucide-react'
import { dbFetch } from '../lib/db'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import EmptyState from '../components/EmptyState'
import { PageLoader } from '../components/LoadingSpinner'
import { formatCurrency, formatDate } from '../utils/formatters'
import { getTodayString, monthsRemaining } from '../utils/dateUtils'
import toast from 'react-hot-toast'

export default function Savings() {
  const { profile } = useAuth()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [contributeGoalId, setContributeGoalId] = useState(null)

  const hid = profile?.household_id

  async function load() {
    if (!hid) return
    const rows = await dbFetch(
      'SELECT * FROM savings_goals WHERE household_id = $1 ORDER BY created_at',
      [hid]
    )
    setGoals(rows)
    setLoading(false)
  }

  useEffect(() => { load() }, [hid])

  const totalSaved = goals.reduce((s, g) => s + Number(g.current_amount), 0)
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0)

  if (loading) return <Layout><PageLoader /></Layout>

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Savings Goals</h1>
            <p className="text-slate-500 text-sm mt-1">{formatCurrency(totalSaved)} saved of {formatCurrency(totalTarget)} total</p>
          </div>
          <button onClick={() => setShowGoalForm(!showGoalForm)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New goal
          </button>
        </div>

        {showGoalForm && <GoalForm hid={hid} onSuccess={() => { setShowGoalForm(false); load() }} />}

        {goals.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={PiggyBank}
              title="No savings goals yet"
              description="Set a goal to save for something special — a holiday, emergency fund, or anything your household dreams of."
              action={<button className="btn-primary" onClick={() => setShowGoalForm(true)}>Create your first goal</button>}
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {goals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                isContributing={contributeGoalId === goal.id}
                onContribute={() => setContributeGoalId(goal.id)}
                onCancelContribute={() => setContributeGoalId(null)}
                hid={hid}
                onRefresh={load}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

function GoalCard({ goal, isContributing, onContribute, onCancelContribute, hid, onRefresh }) {
  const pct = Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100)
  const months = monthsRemaining(goal.target_date)
  const remaining = Number(goal.target_amount) - Number(goal.current_amount)
  const monthlyNeeded = months > 0 ? remaining / months : null
  const onTrack = goal.monthly_contribution && monthlyNeeded && Number(goal.monthly_contribution) >= monthlyNeeded

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">{goal.name}</h3>
          {goal.target_date && (
            <p className="text-xs text-slate-400 mt-0.5">Target: {formatDate(goal.target_date)}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-teal-700">{formatCurrency(goal.current_amount)}</p>
          <p className="text-xs text-slate-400">of {formatCurrency(goal.target_amount)}</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>{Math.round(pct)}% complete</span>
          <span>{formatCurrency(remaining)} to go</span>
        </div>
        <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${pct >= 100 ? 'bg-emerald-500' : 'bg-teal-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {(months !== null || goal.monthly_contribution) && (
        <div className="flex gap-3 text-xs">
          {months !== null && months > 0 && (
            <div className="flex items-center gap-1 text-slate-500">
              <Target size={12} />
              {months}mo remaining
            </div>
          )}
          {goal.monthly_contribution && (
            <div className={`flex items-center gap-1 ${onTrack ? 'text-emerald-600' : 'text-amber-600'}`}>
              <TrendingUp size={12} />
              {onTrack ? 'On track' : 'Behind'} ({formatCurrency(goal.monthly_contribution)}/mo)
            </div>
          )}
        </div>
      )}

      {isContributing ? (
        <ContributeForm goalId={goal.id} hid={hid} onSuccess={() => { onCancelContribute(); onRefresh() }} onCancel={onCancelContribute} />
      ) : (
        <button onClick={onContribute} className="btn-primary w-full text-sm py-1.5">
          + Log contribution
        </button>
      )}
    </div>
  )
}

function ContributeForm({ goalId, hid, onSuccess, onCancel }) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(getTodayString())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await dbFetch(
        'INSERT INTO savings_contributions (goal_id, household_id, amount, date, notes) VALUES ($1, $2, $3, $4, $5)',
        [goalId, hid, Number(amount), date, notes]
      )
      const goalRows = await dbFetch('SELECT current_amount FROM savings_goals WHERE id = $1', [goalId])
      await dbFetch(
        'UPDATE savings_goals SET current_amount = $1 WHERE id = $2',
        [Number(goalRows[0].current_amount) + Number(amount), goalId]
      )
      toast.success('Contribution logged!')
      onSuccess()
    } catch {
      toast.error('Failed to log contribution')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-3 border-t border-stone-100">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Amount ($)</label>
          <input type="number" min="0.01" step="0.01" className="input" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className="label">Notes (optional)</label>
        <input type="text" className="input" placeholder="e.g. Monthly transfer" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary text-sm" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn-secondary text-sm" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function GoalForm({ hid, onSuccess }) {
  const [form, setForm] = useState({ name: '', target_amount: '', target_date: '', monthly_contribution: '' })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await dbFetch(
        'INSERT INTO savings_goals (household_id, name, target_amount, current_amount, target_date, monthly_contribution) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          hid,
          form.name,
          Number(form.target_amount),
          0,
          form.target_date || null,
          form.monthly_contribution ? Number(form.monthly_contribution) : null,
        ]
      )
      toast.success('Goal created!')
      onSuccess()
    } catch {
      toast.error('Failed to create goal')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h3 className="section-title mb-4">New savings goal</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label className="label">Goal name</label>
          <input type="text" className="input" placeholder="e.g. Emergency fund" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
        </div>
        <div>
          <label className="label">Target amount ($)</label>
          <input type="number" min="0" step="0.01" className="input" placeholder="0.00" value={form.target_amount}
            onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Target date (optional)</label>
          <input type="date" className="input" value={form.target_date}
            onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} />
        </div>
        <div>
          <label className="label">Monthly contribution ($)</label>
          <input type="number" min="0" step="0.01" className="input" placeholder="Optional" value={form.monthly_contribution}
            onChange={e => setForm(f => ({ ...f, monthly_contribution: e.target.value }))} />
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create goal'}</button>
        <button type="button" className="btn-secondary" onClick={onSuccess}>Cancel</button>
      </div>
    </form>
  )
}
