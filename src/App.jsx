import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './hooks/useAuth'
import { HouseholdProvider } from './hooks/useHousehold'
import ProtectedRoute, { HouseholdRoute } from './components/ProtectedRoute'

import Login from './pages/Login'
import Signup from './pages/Signup'
import VerifyEmail from './pages/VerifyEmail'
import HouseholdSetup from './pages/HouseholdSetup'
import Dashboard from './pages/Dashboard'
import Budgets from './pages/Budgets'
import Transactions from './pages/Transactions'
import Bills from './pages/Bills'
import Savings from './pages/Savings'
import Household from './pages/Household'
import Reports from './pages/Reports'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <HouseholdProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: { borderRadius: '10px', fontSize: '14px' },
              success: { iconTheme: { primary: '#0d9488', secondary: '#fff' } },
            }}
          />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify-email" element={<VerifyEmail />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/household-setup" element={<HouseholdSetup />} />
            </Route>

            <Route element={<HouseholdRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/bills" element={<Bills />} />
              <Route path="/savings" element={<Savings />} />
              <Route path="/household" element={<Household />} />
              <Route path="/reports" element={<Reports />} />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </HouseholdProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
