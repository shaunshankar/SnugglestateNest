export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-teal-400" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-slate-700 mb-1">{title}</h3>
      {description && <p className="text-slate-500 text-sm mb-4 max-w-xs">{description}</p>}
      {action}
    </div>
  )
}
