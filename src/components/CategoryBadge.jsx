import { getCategoryColor } from '../utils/categories'

export default function CategoryBadge({ category, size = 'sm' }) {
  const colors = getCategoryColor(category)
  const sizes = { sm: 'text-xs px-2 py-0.5', md: 'text-sm px-3 py-1' }
  return (
    <span className={`inline-flex items-center font-medium rounded-full ${colors.bg} ${colors.text} ${sizes[size]}`}>
      {category}
    </span>
  )
}
