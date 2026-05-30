import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingDown, TrendingUp, PiggyBank, ArrowRight } from 'lucide-react'
import { dbFetch } from '../lib/db'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../hooks/useHousehold'
import Layout from '../components/Layout'
import BudgetProgressBar from '../components/BudgetProgressBar'
import { PageLoader } from '../components/LoadingSpinner'
import { formatCurrency, formatDate, formatOrdinal } from '../utils/formatters'
import { getMonthStart, getMonthEnd, getTodayString, addDays } from '../utils/dateUtils'
import { CATEGORIES } from '../utils/categories'

export default function Dashboard() {
  const { profile } = useAuth()
  const { household } = useHousehold()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.household_id) return

    async function load() {
      const hid = profile.household_id
      const today = getTodayString()
      const monthStart = getMonthStart()
      const monthEnd = getMonthEnd()

      const [txRows, budgetRows, billRows, goalRows] = await Promise.all([
        dbFetch(
          'SELECT amount, category FROM transactions WHERE household_id = $1 AND date >= $2 AND date <= $3',
          [hid, monthStart, monthEnd]
        ),
        dbFetch('SELECT * FROM budgets WHERE household_id = $1', [hid]),
        dbFetch('SELECT * FROM bills WHERE household_id = $1 AND is_active = true', [hid]),
        dbFetch('SELECT * FROM savings_goals WHERE household_id = $1 ORDER BY created_at', [hid]),
      ])

      const transactions = txRows
      const budgets = budgetRows
      const bills = billRows
      const goals = goalRows

      const totalSpent = transactions.reduce((s, t) => s + Number(t.amount), 0)
      const totalSaved = goals.reduce((s, g) => s + Number(g.current_amount), 0)

      const spentByCategory = {}
      CATEGORIES.forEach(c => { spentByCategory[c] = 0 })
      transactions.forEach(t => { spentByCategory[t.category] = (spentByCategory[t.category] || 0) + Number(t.amount) })

      const todayDay = new Date().getDate()
      const upcomingBills = bills.filter(b => {
        const daysUntil = b.due_day >= todayDay
          ? b.due_day - todayDay
          : 31 - todayDay + b.due_day
        return daysUntil <= 7
      }).sort((a, b) => a.due_day - b.due_day)

      setData({ totalSpent, totalSaved, spentByCategory, budgets, upcomingBills, goals: goals.slice(0, 3) })
      setLoading(false)
    }

    load()
  }, [profile?.household_id])

  if (loading) return <Layout><PageLoader /></Layout>

  const { totalSpent, totalSaved, spentByCategory, budgets, upcomingBills, goals } = data

  const totalBudget = budgets.reduce((s, b) => s + Number(b.monthly_limit), 0)

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Good {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'there'} 👋</h1>
          <p className="text-slate-500 text-sm mt-1">{household?.name} · {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            label="Spent this month"
            value={formatCurrency(totalSpent)}
            icon={TrendingDown}
            iconColor="text-red-500"
            bg="bg-red-50"
          />
          <SummaryCard
            label="Total budget"
            value={formatCurrency(totalBudget)}
            icon={TrendingUp}
            iconColor="text-teal-600"
            bg="bg-teal-50"
            sub={totalBudget > 0 ? `${Math.round((totalSpent / totalBudget) * 100)}% used` : null}
          />
          <SummaryCard
            label="Nest egg (savings)"
            value={formatCurrency(totalSaved)}
            icon={PiggyBank}
            iconColor="text-amber-500"
            bg="bg-amber-50"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Budget progress */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Budget this month</h2>
              <Link to="/budgets" className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1">
                View all <ArrowRight size={14} />
              </Link>
            </div>
            {budgets.length === 0 ? (
              <p className="text-slate-400 text-sm">No budgets set yet. <Link to="/budgets" className="text-teal-600">Set up budgets →</Link></p>
            ) : (
              <div className="space-y-4">
                {budgets.slice(0, 5).map(b => (
                  <BudgetProgressBar
                    key={b.id}
                    category={b.category}
                    spent={spentByCategory[b.category] || 0}
                    limit={Number(b.monthly_limit)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* Upcoming bills */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title">Bills due soon</h2>
                <Link to="/bills" className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1">
                  View all <ArrowRight size={14} />
                </Link>
              </div>
              {upcomingBills.length === 0 ? (
                <p className="text-slate-400 text-sm">No bills due in the next 7 days 🎉</p>
              ) : (
                <div className="space-y-2">
                  {upcomingBills.map(bill => {
                    const daysUntil = bill.due_day >= new Date().getDate()
                      ? bill.due_day - new Date().getDate()
                      : 31 - new Date().getDate() + bill.due_day
                    return (
                      <div key={bill.id} className="flex items-center justify-between py-1.5 border-b border-stone-50 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{bill.name}</p>
                          <p className="text-xs text-slate-400">Due {formatOrdinal(bill.due_day)} · {daysUntil === 0 ? 'Today' : `${daysUntil}d`}</p>
                        </div>
                        <span className={`text-sm font-semibold ${daysUntil <= 2 ? 'text-red-600' : 'text-slate-700'}`}>
                          {formatCurrency(bill.amount)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Savings goals */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title">Savings goals</h2>
                <Link to="/savings" className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1">
                  View all <ArrowRight size={14} />
                </Link>
              </div>
              {goals.length === 0 ? (
                <p className="text-slate-400 text-sm">No savings goals yet. <Link to="/savings" className="text-teal-600">Create one →</Link></p>
              ) : (
                <div className="space-y-3">
                  {goals.map(goal => {
                    const pct = Math.min((goal.current_amount / goal.target_amount) * 100, 100)
                    return (
                      <div key={goal.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-slate-700">{goal.name}</span>
                          <span className="text-slate-500">{Math.round(pct)}%</span>
                        </div>
                        <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-slate-400 mt-1">
                          <span>{formatCurrency(goal.current_amount)}</span>
                          <span>{formatCurrency(goal.target_amount)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

function SummaryCard({ label, value, icon: Icon, iconColor, bg, sub }) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-800 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
