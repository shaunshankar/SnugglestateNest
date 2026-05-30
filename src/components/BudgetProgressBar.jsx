import { formatCurrency } from '../utils/formatters'

export default function BudgetProgressBar({ category, spent, limit, showAmounts = true }) {
  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
  const over = spent > limit && limit > 0

  let barColor = 'bg-emerald-500'
  if (pct >= 90) barColor = 'bg-red-500'
  else if (pct >= 70) barColor = 'bg-amber-500'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{category}</span>
        {showAmounts && (
          <span className={`text-sm ${over ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
            {formatCurrency(spent)} {limit > 0 && `/ ${formatCurrency(limit)}`}
          </span>
        )}
      </div>
      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {over && (
        <p className="text-xs text-red-500">{formatCurrency(spent - limit)} over budget</p>
      )}
    </div>
  )
}
