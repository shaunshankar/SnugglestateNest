import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts'
import { dbFetch } from '../lib/db'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import EmptyState from '../components/EmptyState'
import { PageLoader } from '../components/LoadingSpinner'
import { formatCurrency } from '../utils/formatters'
import { getMonthStart, getMonthEnd, subtractMonths, getShortMonthLabel } from '../utils/dateUtils'
import { CATEGORIES, CATEGORY_COLORS } from '../utils/categories'

export default function Reports() {
  const { profile } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [monthData, setMonthData] = useState(null)
  const [trendData, setTrendData] = useState([])
  const [loading, setLoading] = useState(true)

  const hid = profile?.household_id

  useEffect(() => {
    if (!hid) return
    load()
  }, [hid, currentDate])

  async function load() {
    setLoading(true)
    const monthStart = getMonthStart(currentDate)
    const monthEnd = getMonthEnd(currentDate)

    const txRows = await dbFetch(
      'SELECT amount, category, date FROM transactions WHERE household_id = $1 AND date >= $2 AND date <= $3',
      [hid, monthStart, monthEnd]
    )

    const byCategory = {}
    CATEGORIES.forEach(c => { byCategory[c] = 0 })
    txRows.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount) })

    const pieData = Object.entries(byCategory)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)), color: CATEGORY_COLORS[name]?.chart || '#94a3b8' }))
      .sort((a, b) => b.value - a.value)

    const totalSpent = pieData.reduce((s, d) => s + d.value, 0)

    const savingsGoalRows = await dbFetch(
      'SELECT current_amount FROM savings_goals WHERE household_id = $1',
      [hid]
    )
    const totalSavings = savingsGoalRows.reduce((s, g) => s + Number(g.current_amount), 0)

    setMonthData({ pieData, totalSpent, totalSavings, ranked: [...pieData].sort((a, b) => b.value - a.value) })

    // Build 6-month trend
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = subtractMonths(new Date(), i)
      months.push({ date: d, label: getShortMonthLabel(d) })
    }

    const trendResults = await Promise.all(months.map(async ({ date, label }) => {
      const rows = await dbFetch(
        'SELECT amount, category FROM transactions WHERE household_id = $1 AND date >= $2 AND date <= $3',
        [hid, getMonthStart(date), getMonthEnd(date)]
      )
      const total = rows.reduce((s, t) => s + Number(t.amount), 0)
      const savings = rows.filter(t => t.category === 'Savings').reduce((s, t) => s + Number(t.amount), 0)
      return { label, total: Number(total.toFixed(2)), savings: Number(savings.toFixed(2)) }
    }))

    setTrendData(trendResults)
    setLoading(false)
  }

  function prevMonth() {
    setCurrentDate(d => subtractMonths(d, 1))
  }
  function nextMonth() {
    const next = subtractMonths(currentDate, -1)
    if (next <= new Date()) setCurrentDate(next)
  }

  const isCurrentMonth = currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear()

  if (loading) return <Layout><PageLoader /></Layout>

  const { pieData, totalSpent, ranked } = monthData

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="page-title">Reports</h1>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="btn-secondary p-2"><ChevronLeft size={16} /></button>
            <span className="text-sm font-medium text-slate-700 min-w-[120px] text-center">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={nextMonth} className="btn-secondary p-2" disabled={isCurrentMonth}><ChevronRight size={16} /></button>
          </div>
        </div>

        {pieData.length === 0 ? (
          <div className="card">
            <EmptyState icon={BarChart2} title="No data for this month" description="Add some transactions to see your spending breakdown." />
          </div>
        ) : (
          <>
            {/* Pie chart + ranked list */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <h2 className="section-title mb-4">Spending by category</h2>
                <p className="text-2xl font-bold text-slate-800 mb-4">{formatCurrency(totalSpent)} total</p>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={v => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <h2 className="section-title mb-4">Biggest categories</h2>
                <div className="space-y-3">
                  {ranked.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="text-slate-400 text-sm w-5 text-right">{i + 1}</span>
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color }} />
                      <span className="text-sm text-slate-700 flex-1">{item.name}</span>
                      <span className="text-sm font-semibold text-slate-800">{formatCurrency(item.value)}</span>
                      <span className="text-xs text-slate-400 w-10 text-right">{totalSpent > 0 ? Math.round((item.value / totalSpent) * 100) : 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 6-month bar chart */}
            <div className="card">
              <h2 className="section-title mb-4">Month-over-month spending (last 6 months)</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="total" name="Total spent" fill="#0d9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Savings rate line chart */}
            <div className="card">
              <h2 className="section-title mb-4">Savings over time</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Line type="monotone" dataKey="savings" name="Savings logged" stroke="#14b8a6" strokeWidth={2} dot={{ fill: '#14b8a6', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
