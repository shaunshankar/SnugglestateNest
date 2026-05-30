import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { PageLoader } from './LoadingSpinner'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

export function HouseholdRoute() {
  const { user, profile, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  if (!profile?.household_id) return <Navigate to="/household-setup" replace />
  return <Outlet />
}
