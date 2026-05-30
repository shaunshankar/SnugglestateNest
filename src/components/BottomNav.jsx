import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Wallet, Receipt, PiggyBank, BarChart2 } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/budgets', icon: Wallet, label: 'Budgets' },
  { to: '/transactions', icon: Receipt, label: 'Txns' },
  { to: '/savings', icon: PiggyBank, label: 'Savings' },
  { to: '/reports', icon: BarChart2, label: 'Reports' },
]

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 z-50 safe-area-bottom">
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-2 text-xs font-medium transition-colors ${
                isActive ? 'text-teal-600' : 'text-slate-500'
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
