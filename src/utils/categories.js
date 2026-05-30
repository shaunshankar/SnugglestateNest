export const CATEGORIES = [
  'Housing',
  'Groceries',
  'Transport',
  'Utilities',
  'Entertainment',
  'Dining Out',
  'Health',
  'Personal Care',
  'Savings',
  'Other',
]

export const CATEGORY_COLORS = {
  Housing: { bg: 'bg-blue-100', text: 'text-blue-700', chart: '#3b82f6' },
  Groceries: { bg: 'bg-green-100', text: 'text-green-700', chart: '#22c55e' },
  Transport: { bg: 'bg-orange-100', text: 'text-orange-700', chart: '#f97316' },
  Utilities: { bg: 'bg-yellow-100', text: 'text-yellow-700', chart: '#eab308' },
  Entertainment: { bg: 'bg-purple-100', text: 'text-purple-700', chart: '#a855f7' },
  'Dining Out': { bg: 'bg-red-100', text: 'text-red-700', chart: '#ef4444' },
  Health: { bg: 'bg-pink-100', text: 'text-pink-700', chart: '#ec4899' },
  'Personal Care': { bg: 'bg-indigo-100', text: 'text-indigo-700', chart: '#6366f1' },
  Savings: { bg: 'bg-teal-100', text: 'text-teal-700', chart: '#14b8a6' },
  Other: { bg: 'bg-stone-100', text: 'text-stone-700', chart: '#78716c' },
}

export function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS['Other']
}
