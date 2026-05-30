import { useEffect, useState } from 'react'
import { Pencil, Check, X, Wallet } from 'lucide-react'
import { dbFetch } from '../lib/db'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../hooks/useHousehold'
import Layout from '../components/Layout'
import BudgetProgressBar from '../components/BudgetProgressBar'
import EmptyState from '../components/EmptyState'
import { PageLoader } from '../components/LoadingSpinner'
import { formatCurrency } from '../utils/formatters'
import { getMonthStart, getMonthEnd, getMonthLabel } from '../utils/dateUtils'
import { CATEGORIES } from '../utils/categories'
import toast from 'react-hot-toast'

export default function Budgets() {
  const { profile } = useAuth()
  const { isOwner } = useHousehold()
  const [budgets, setBudgets] = useState([])
  const [spentByCategory, setSpentByCategory] = useState({})
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addCategory, setAddCategory] = useState('')
  const [addLimit, setAddLimit] = useState('')
  const [saving, setSaving] = useState(false)

  const hid = profile?.household_id

  async function load() {
    if (!hid) return
    const [budgetRows, txRows] = await Promise.all([
      dbFetch('SELECT * FROM budgets WHERE household_id = $1 ORDER BY category', [hid]),
      dbFetch(
        'SELECT amount, category FROM transactions WHERE household_id = $1 AND date >= $2 AND date <= $3',
        [hid, getMonthStart(), getMonthEnd()]
      ),
    ])
    setBudgets(budgetRows)
    const spent = {}
    txRows.forEach(t => { spent[t.category] = (spent[t.category] || 0) + Number(t.amount) })
    setSpentByCategory(spent)
    setLoading(false)
  }

  useEffect(() => { load() }, [hid])

  async function saveEdit(budget) {
    if (!editValue || isNaN(Number(editValue))) return
    setSaving(true)
    try {
      await dbFetch(
        'UPDATE budgets SET monthly_limit = $1 WHERE id = $2',
        [Number(editValue), budget.id]
      )
      toast.success('Budget updated')
      setEditingId(null)
      load()
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!addCategory || !addLimit) return
    setSaving(true)
    try {
      await dbFetch(
        `INSERT INTO budgets (household_id, category, monthly_limit)
         VALUES ($1, $2, $3)
         ON CONFLICT (household_id, category) DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit`,
        [hid, addCategory, Number(addLimit)]
      )
      toast.success('Budget saved')
      setShowAdd(false)
      setAddCategory('')
      setAddLimit('')
      load()
    } catch {
      toast.error('Failed to save budget')
    } finally {
      setSaving(false)
    }
  }

  async function deleteBudget(id) {
    try {
      await dbFetch('DELETE FROM budgets WHERE id = $1', [id])
      toast.success('Budget removed')
      load()
    } catch {
      toast.error('Failed to delete')
    }
  }

  const existingCategories = new Set(budgets.map(b => b.category))
  const availableCategories = CATEGORIES.filter(c => !existingCategories.has(c))

  const totalBudget = budgets.reduce((s, b) => s + Number(b.monthly_limit), 0)
  const totalSpent = Object.values(spentByCategory).reduce((s, v) => s + v, 0)

  if (loading) return <Layout><PageLoader /></Layout>

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Budgets</h1>
            <p className="text-slate-500 text-sm mt-1">{getMonthLabel()}</p>
          </div>
          {isOwner && availableCategories.length > 0 && (
            <button onClick={() => setShowAdd(!showAdd)} className="btn-primary">
              + Add budget
            </button>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="card">
            <p className="text-sm text-slate-500">Total budget</p>
            <p className="text-xl font-bold text-teal-700 mt-1">{formatCurrency(totalBudget)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Total spent</p>
            <p className={`text-xl font-bold mt-1 ${totalSpent > totalBudget ? 'text-red-600' : 'text-slate-800'}`}>
              {formatCurrency(totalSpent)}
            </p>
          </div>
          <div className="card col-span-2 sm:col-span-1">
            <p className="text-sm text-slate-500">Remaining</p>
            <p className={`text-xl font-bold mt-1 ${totalBudget - totalSpent < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {formatCurrency(Math.max(0, totalBudget - totalSpent))}
            </p>
          </div>
        </div>

        {/* Add form */}
        {showAdd && isOwner && (
          <form onSubmit={handleAdd} className="card">
            <h3 className="section-title mb-4">Add a budget</h3>
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <label className="label">Category</label>
                <select className="input" value={addCategory} onChange={e => setAddCategory(e.target.value)} required>
                  <option value="">Select category…</option>
                  {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="label">Monthly limit ($)</label>
                <input type="number" min="0" step="0.01" className="input" placeholder="0.00" value={addLimit} onChange={e => setAddLimit(e.target.value)} required />
              </div>
              <div className="flex items-end gap-2">
                <button type="submit" className="btn-primary" disabled={saving}>Save</button>
                <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              </div>
            </div>
          </form>
        )}

        {/* Budget list */}
        {budgets.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Wallet}
              title="No budgets yet"
              description={isOwner ? "Set monthly spending limits for each category to keep your household on track." : "Your household owner hasn't set up budgets yet."}
              action={isOwner && <button className="btn-primary" onClick={() => setShowAdd(true)}>Set up budgets</button>}
            />
          </div>
        ) : (
          <div className="card space-y-6">
            {budgets.map(budget => (
              <div key={budget.id} className="group">
                {editingId === budget.id ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700 flex-1">{budget.category}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input w-32 text-right"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        autoFocus
                      />
                      <button onClick={() => saveEdit(budget)} className="p-1.5 text-teal-600 hover:bg-teal-50 rounded" disabled={saving}>
                        <Check size={16} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-stone-50 rounded">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <BudgetProgressBar
                        category={budget.category}
                        spent={spentByCategory[budget.category] || 0}
                        limit={Number(budget.monthly_limit)}
                      />
                    </div>
                    {isOwner && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                        <button
                          onClick={() => { setEditingId(budget.id); setEditValue(budget.monthly_limit) }}
                          className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => deleteBudget(budget.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!isOwner && (
          <p className="text-xs text-slate-400 text-center">Only the household owner can edit budgets</p>
        )}
      </div>
    </Layout>
  )
}
