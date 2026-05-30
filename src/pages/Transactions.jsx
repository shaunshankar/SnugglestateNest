import { useEffect, useRef, useState, useCallback } from 'react'
import { Plus, Upload, Search, Receipt, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'
import Papa from 'papaparse'
import { client } from '../lib/auth'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import CategoryBadge from '../components/CategoryBadge'
import EmptyState from '../components/EmptyState'
import { PageLoader } from '../components/LoadingSpinner'
import { formatCurrency, formatDate } from '../utils/formatters'
import { getTodayString } from '../utils/dateUtils'
import { CATEGORIES } from '../utils/categories'
import { suggestCategory, categorizeTransactions } from '../lib/anthropic'
import toast from 'react-hot-toast'

const PAGE_SIZE = 20

export default function Transactions() {
  const { profile } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [csvRows, setCsvRows] = useState(null)
  const [csvLoading, setCsvLoading] = useState(false)
  const fileInputRef = useRef()

  const hid = profile?.household_id

  const load = useCallback(async () => {
    if (!hid) return
    setLoading(true)
    let q = client.from('transactions').select('*', { count: 'exact' })
      .eq('household_id', hid)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (search) q = q.or(`merchant.ilike.%${search}%,notes.ilike.%${search}%`)
    if (filterCategory) q = q.eq('category', filterCategory)
    if (filterFrom) q = q.gte('date', filterFrom)
    if (filterTo) q = q.lte('date', filterTo)

    const { data, count } = await q
    setTransactions(data || [])
    setTotalCount(count || 0)
    setLoading(false)
  }, [hid, page, search, filterCategory, filterFrom, filterTo])

  useEffect(() => { load() }, [load])

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        setCsvLoading(true)
        try {
          const categorised = await categorizeTransactions(results.data)
          setCsvRows(categorised.map((row, i) => ({ ...row, _id: i, _confirmed: true })))
        } catch {
          toast.error('Failed to categorize transactions')
        } finally {
          setCsvLoading(false)
        }
      },
    })
    e.target.value = ''
  }

  async function confirmCsvImport() {
    if (!csvRows?.length) return
    const rows = csvRows.map(row => {
      const amount = parseFloat(Object.values(row).find(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0) || 0)
      const dateVal = Object.entries(row).find(([k]) => k.toLowerCase().includes('date'))?.[1] || getTodayString()
      const merchant = Object.entries(row).find(([k]) => k.toLowerCase().includes('merchant') || k.toLowerCase().includes('description') || k.toLowerCase().includes('name'))?.[1] || 'Unknown'
      return {
        household_id: hid,
        user_id: profile.id,
        amount: Math.abs(amount),
        category: row.category || 'Other',
        date: tryParseDate(dateVal),
        merchant: String(merchant).slice(0, 200),
        notes: '',
      }
    }).filter(r => r.amount > 0)

    const { error } = await client.from('transactions').insert(rows)
    if (error) { toast.error('Import failed'); return }
    toast.success(`${rows.length} transactions imported`)
    setCsvRows(null)
    load()
  }

  async function deleteTransaction(id) {
    const { error } = await client.from('transactions').delete().eq('id', id)
    if (!error) load()
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="page-title">Transactions</h1>
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            <button onClick={() => fileInputRef.current.click()} className="btn-secondary flex items-center gap-2" disabled={csvLoading}>
              <Upload size={16} />{csvLoading ? 'Processing…' : 'Import CSV'}
            </button>
            <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Add
            </button>
          </div>
        </div>

        {showForm && <AddTransactionForm hid={hid} profileId={profile?.id} onSuccess={() => { setShowForm(false); load() }} />}

        {csvRows && (
          <CsvReviewPanel rows={csvRows}
            onUpdateRow={(id, field, val) => setCsvRows(prev => prev.map(r => r._id === id ? { ...r, [field]: val } : r))}
            onConfirm={confirmCsvImport} onCancel={() => setCsvRows(null)} />
        )}

        <div className="card">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" className="input pl-9" placeholder="Search merchant or notes…" value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }} />
            </div>
            <select className="input w-auto min-w-[140px]" value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(0) }}>
              <option value="">All categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" className="input w-auto" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(0) }} />
            <input type="date" className="input w-auto" value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(0) }} />
            {(search || filterCategory || filterFrom || filterTo) && (
              <button className="btn-secondary text-sm" onClick={() => { setSearch(''); setFilterCategory(''); setFilterFrom(''); setFilterTo(''); setPage(0) }}>Clear</button>
            )}
          </div>
        </div>

        {loading ? <PageLoader /> : transactions.length === 0 ? (
          <div className="card">
            <EmptyState icon={Receipt} title="No transactions" description="Add a transaction or import a CSV bank statement." />
          </div>
        ) : (
          <div className="card divide-y divide-stone-50">
            {transactions.map(tx => (
              <TransactionRow key={tx.id} tx={tx} onDelete={() => deleteTransaction(tx.id)} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{totalCount} transactions</p>
            <div className="flex gap-2">
              <button className="btn-secondary p-2" onClick={() => setPage(p => p - 1)} disabled={page === 0}><ChevronLeft size={16} /></button>
              <span className="text-sm text-slate-600 flex items-center px-2">{page + 1} / {totalPages}</span>
              <button className="btn-secondary p-2" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

function TransactionRow({ tx, onDelete }) {
  return (
    <div className="flex items-center gap-4 py-3 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-slate-800 truncate">{tx.merchant || 'Unknown'}</p>
          <CategoryBadge category={tx.category} />
        </div>
        {tx.notes && <p className="text-xs text-slate-400 mt-0.5 truncate">{tx.notes}</p>}
        <p className="text-xs text-slate-400 mt-0.5">{formatDate(tx.date)}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-semibold text-slate-800">{formatCurrency(tx.amount)}</span>
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-400 transition-all"><X size={14} /></button>
      </div>
    </div>
  )
}

function AddTransactionForm({ hid, profileId, onSuccess }) {
  const [form, setForm] = useState({ amount: '', category: '', date: getTodayString(), merchant: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [suggestion, setSuggestion] = useState(null)
  const debounceRef = useRef()

  function handleMerchantChange(val) {
    setForm(f => ({ ...f, merchant: val }))
    clearTimeout(debounceRef.current)
    if (val.length >= 3) {
      debounceRef.current = setTimeout(async () => {
        const cat = await suggestCategory(val)
        setSuggestion(cat)
      }, 600)
    } else {
      setSuggestion(null)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await client.from('transactions').insert({
      household_id: hid,
      user_id: profileId,
      amount: Number(form.amount),
      category: form.category,
      date: form.date,
      merchant: form.merchant,
      notes: form.notes,
    })
    setSaving(false)
    if (error) { toast.error('Failed to save transaction'); return }
    toast.success('Transaction added')
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h3 className="section-title mb-4">Add transaction</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Amount ($)</label>
          <input type="number" min="0" step="0.01" className="input" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Merchant</label>
          <input type="text" className="input" placeholder="e.g. Whole Foods" value={form.merchant} onChange={e => handleMerchantChange(e.target.value)} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label">Category</label>
          <div className="space-y-1.5">
            <select className="input" value={form.category} onChange={e => { setForm(f => ({ ...f, category: e.target.value })); setSuggestion(null) }} required>
              <option value="">Select category…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {suggestion && form.category !== suggestion && (
              <button type="button" onClick={() => { setForm(f => ({ ...f, category: suggestion })); setSuggestion(null) }}
                className="inline-flex items-center gap-1 text-xs bg-teal-50 text-teal-700 px-2 py-1 rounded-full hover:bg-teal-100 transition-colors">
                <Check size={10} /> AI suggests: {suggestion}
              </button>
            )}
          </div>
        </div>
        <div className="col-span-2 sm:col-span-2">
          <label className="label">Notes (optional)</label>
          <input type="text" className="input" placeholder="Any notes…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add transaction'}</button>
        <button type="button" className="btn-secondary" onClick={onSuccess}>Cancel</button>
      </div>
    </form>
  )
}

function CsvReviewPanel({ rows, onUpdateRow, onConfirm, onCancel }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title">Review imported transactions ({rows.length})</h3>
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
          <button onClick={onConfirm} className="btn-primary text-sm">Import all</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-stone-100">
              <th className="pb-2 font-medium pr-4">Description</th>
              <th className="pb-2 font-medium pr-4">Amount</th>
              <th className="pb-2 font-medium pr-4">Date</th>
              <th className="pb-2 font-medium">Category</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {rows.slice(0, 50).map(row => {
              const desc = row.Description || row.description || row.Merchant || row.merchant || row.Name || Object.values(row).find(v => typeof v === 'string' && v.length > 2) || ''
              const amount = row.Amount || row.amount || row.Debit || row.debit || ''
              const date = row.Date || row.date || row.TransactionDate || ''
              return (
                <tr key={row._id}>
                  <td className="py-2 pr-4 text-slate-700 max-w-[200px] truncate">{String(desc).slice(0, 50)}</td>
                  <td className="py-2 pr-4 text-slate-700">{amount}</td>
                  <td className="py-2 pr-4 text-slate-500">{date}</td>
                  <td className="py-2">
                    <select className="input py-1 text-xs" value={row.category || 'Other'} onChange={e => onUpdateRow(row._id, 'category', e.target.value)}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length > 50 && <p className="text-xs text-slate-400 mt-2">Showing first 50 of {rows.length} rows</p>}
      </div>
    </div>
  )
}

function tryParseDate(val) {
  if (!val) return getTodayString()
  const d = new Date(val)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return getTodayString()
}
