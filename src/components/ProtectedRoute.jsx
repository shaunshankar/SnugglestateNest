import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { PageLoader } from './LoadingSpinner'

const PUBLIC_PATHS = ['/login', '/signup', '/verify-email']

export default function ProtectedRoute() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  if (loading) return <PageLoader />
  if (!user && !PUBLIC_PATHS.includes(pathname)) return <Navigate to="/login" replace />
  return <Outlet />
}

export function HouseholdRoute() {
  const { user, profile, loading } = useAuth()
  const { pathname } = useLocation()
  if (loading) return <PageLoader />
  if (!user && !PUBLIC_PATHS.includes(pathname)) return <Navigate to="/login" replace />
  if (user && !profile?.household_id) return <Navigate to="/household-setup" replace />
  return <Outlet />
}
