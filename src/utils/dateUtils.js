export function getMonthStart(date = new Date()) {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

export function getMonthEnd(date = new Date()) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + 1, 0)
  d.setHours(23, 59, 59, 999)
  return d.toISOString().split('T')[0]
}

export function getTodayString() {
  return new Date().toISOString().split('T')[0]
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function getMonthLabel(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date)
}

export function getShortMonthLabel(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(date)
}

export function subtractMonths(date, months) {
  const d = new Date(date)
  d.setMonth(d.getMonth() - months)
  return d
}

export function getDaysUntil(targetDay) {
  const today = new Date()
  const thisMonth = today.getMonth()
  const thisYear = today.getFullYear()
  let target = new Date(thisYear, thisMonth, targetDay)
  if (target <= today) {
    target = new Date(thisYear, thisMonth + 1, targetDay)
  }
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24))
  return diff
}

export function getNextDueDate(dueDay) {
  const today = new Date()
  let candidate = new Date(today.getFullYear(), today.getMonth(), dueDay)
  if (candidate <= today) {
    candidate = new Date(today.getFullYear(), today.getMonth() + 1, dueDay)
  }
  return candidate.toISOString().split('T')[0]
}

export function monthsRemaining(targetDateStr) {
  if (!targetDateStr) return null
  const now = new Date()
  const target = new Date(targetDateStr)
  const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
  return Math.max(0, months)
}
