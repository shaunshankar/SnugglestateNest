import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Wallet, Receipt, FileText, PiggyBank,
  Home, BarChart2, LogOut, Bird,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../hooks/useHousehold'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/budgets', icon: Wallet, label: 'Budgets' },
  { to: '/transactions', icon: Receipt, label: 'Transactions' },
  { to: '/bills', icon: FileText, label: 'Bills' },
  { to: '/savings', icon: PiggyBank, label: 'Savings' },
  { to: '/reports', icon: BarChart2, label: 'Reports' },
  { to: '/household', icon: Home, label: 'Household' },
]

export default function Sidebar() {
  const { signOut, profile } = useAuth()
  const { household } = useHousehold()

  async function handleSignOut() {
    try { await signOut() } catch { toast.error('Failed to sign out') }
  }

  return (
    <aside className="hidden md:flex flex-col w-64 bg-teal-800 text-white min-h-screen">
      <div className="px-6 py-5 border-b border-teal-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
            <Bird className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-none">Snuggle State</p>
            <p className="text-teal-300 text-xs mt-0.5">Nest</p>
          </div>
        </div>
        {household && (
          <p className="text-teal-300 text-xs mt-3 truncate">{household.name}</p>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-teal-600 text-white'
                  : 'text-teal-100 hover:bg-teal-700 hover:text-white'
              }`
            }
          >
            <Icon className="w-4.5 h-4.5 shrink-0" size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-teal-700">
        <div className="px-3 py-2 mb-1">
          <p className="text-white text-sm font-medium truncate">{profile?.full_name || 'User'}</p>
          <p className="text-teal-300 text-xs truncate">{profile?.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-teal-100 hover:bg-teal-700 hover:text-white transition-colors duration-150"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
