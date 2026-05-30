import { useEffect, useState } from 'react'
import { Plus, FileText, Check, ChevronDown, ChevronUp, ToggleLeft, ToggleRight } from 'lucide-react'
import { client } from '../lib/auth'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import CategoryBadge from '../components/CategoryBadge'
import EmptyState from '../components/EmptyState'
import { PageLoader } from '../components/LoadingSpinner'
import { formatCurrency, formatOrdinal } from '../utils/formatters'
import { getTodayString, getDaysUntil } from '../utils/dateUtils'
import { CATEGORIES } from '../utils/categories'
import toast from 'react-hot-toast'

export default function Bills() {
  const { profile } = useAuth()
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  const hid = profile?.household_id

  async function load() {
    if (!hid) return
    const { data } = await client.from('bills').select('*').eq('household_id', hid).order('due_day')
    setBills(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [hid])

  async function markPaid(bill) {
    const { error } = await client.from('bill_payments').insert({
      bill_id: bill.id,
      household_id: hid,
      paid_date: getTodayString(),
      amount: bill.amount,
    })
    if (error) { toast.error('Failed to mark paid'); return }
    toast.success(`${bill.name} marked as paid!`)
  }

  async function toggleActive(bill) {
    const { error } = await client.from('bills').update({ is_active: !bill.is_active }).eq('id', bill.id)
    if (error) { toast.error('Failed to update'); return }
    toast.success(bill.is_active ? 'Bill paused' : 'Bill reactivated')
    load()
  }

  const activeBills = bills.filter(b => b.is_active)
  const inactiveBills = bills.filter(b => !b.is_active)
  const upcoming = activeBills.filter(b => getDaysUntil(b.due_day) <= 30).sort((a, b) => getDaysUntil(a.due_day) - getDaysUntil(b.due_day))
  const rest = activeBills.filter(b => getDaysUntil(b.due_day) > 30)
  const monthlyTotal = activeBills.reduce((s, b) => {
    const factor = b.frequency === 'quarterly' ? 1/3 : b.frequency === 'yearly' ? 1/12 : 1
    return s + Number(b.amount) * factor
  }, 0)

  if (loading) return <Layout><PageLoader /></Layout>

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Bills & Subscriptions</h1>
            <p className="text-slate-500 text-sm mt-1">~{formatCurrency(monthlyTotal)}/mo across {activeBills.length} active bills</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add bill
          </button>
        </div>

        {showForm && <BillForm hid={hid} onSuccess={() => { setShowForm(false); load() }} />}

        {bills.length === 0 ? (
          <div className="card">
            <EmptyState icon={FileText} title="No bills yet" description="Track your recurring bills and subscriptions so nothing sneaks up on you." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Add your first bill</button>} />
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div className="card">
                <h2 className="section-title mb-4">Due in the next 30 days</h2>
                <div className="space-y-3">
                  {upcoming.map(bill => <BillCard key={bill.id} bill={bill} onMarkPaid={markPaid} onToggleActive={toggleActive} />)}
                </div>
              </div>
            )}
            {rest.length > 0 && (
              <div className="card">
                <h2 className="section-title mb-4">All active bills</h2>
                <div className="space-y-3">
                  {rest.map(bill => <BillCard key={bill.id} bill={bill} onMarkPaid={markPaid} onToggleActive={toggleActive} />)}
                </div>
              </div>
            )}
            {inactiveBills.length > 0 && (
              <div className="card">
                <button onClick={() => setShowInactive(!showInactive)} className="flex items-center gap-2 text-slate-500 text-sm hover:text-slate-700 w-full">
                  {showInactive ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {inactiveBills.length} paused bill{inactiveBills.length !== 1 ? 's' : ''}
                </button>
                {showInactive && (
                  <div className="mt-4 space-y-3 opacity-60">
                    {inactiveBills.map(bill => <BillCard key={bill.id} bill={bill} onMarkPaid={markPaid} onToggleActive={toggleActive} />)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}

function BillCard({ bill, onMarkPaid, onToggleActive }) {
  const daysUntil = getDaysUntil(bill.due_day)
  const isUrgent = daysUntil <= 3 && bill.is_active
  return (
    <div className={`flex items-center gap-4 p-3 rounded-xl border ${isUrgent ? 'border-red-100 bg-red-50' : 'border-stone-100 bg-stone-50'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-slate-800">{bill.name}</p>
          <CategoryBadge category={bill.category} />
          <span className="text-xs text-slate-400 capitalize">{bill.frequency}</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Due {formatOrdinal(bill.due_day)} of each month
          {bill.is_active && ` · ${daysUntil === 0 ? 'Due today' : `${daysUntil}d away`}`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-sm font-bold ${isUrgent ? 'text-red-600' : 'text-slate-700'}`}>{formatCurrency(bill.amount)}</span>
        {bill.is_active && (
          <button onClick={() => onMarkPaid(bill)} title="Mark as paid" className="p-1.5 bg-teal-50 hover:bg-teal-100 text-teal-600 rounded-lg transition-colors">
            <Check size={14} />
          </button>
        )}
        <button onClick={() => onToggleActive(bill)} title={bill.is_active ? 'Pause' : 'Reactivate'} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
          {bill.is_active ? <ToggleRight size={16} className="text-teal-500" /> : <ToggleLeft size={16} />}
        </button>
      </div>
    </div>
  )
}

function BillForm({ hid, onSuccess }) {
  const [form, setForm] = useState({ name: '', amount: '', due_day: 1, frequency: 'monthly', category: '' })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await client.from('bills').insert({
      household_id: hid,
      name: form.name,
      amount: Number(form.amount),
      due_day: Number(form.due_day),
      frequency: form.frequency,
      category: form.category,
      is_active: true,
    })
    setSaving(false)
    if (error) { toast.error('Failed to save bill'); return }
    toast.success('Bill added!')
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h3 className="section-title mb-4">Add a bill</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label className="label">Bill name</label>
          <input type="text" className="input" placeholder="e.g. Netflix" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Amount ($)</label>
          <input type="number" min="0" step="0.01" className="input" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Due day of month</label>
          <input type="number" min="1" max="31" className="input" value={form.due_day} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Frequency</label>
          <select className="input" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} required>
            <option value="">Select…</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add bill'}</button>
        <button type="button" className="btn-secondary" onClick={onSuccess}>Cancel</button>
      </div>
    </form>
  )
}
