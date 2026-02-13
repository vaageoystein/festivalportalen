import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthContext } from '@/contexts/AuthContext'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import SetPasswordPage from '@/pages/SetPasswordPage'
import DashboardPage from '@/pages/DashboardPage'
import SalesPage from '@/pages/SalesPage'
import EconomyPage from '@/pages/EconomyPage'
import SponsorsPage from '@/pages/SponsorsPage'
import ReportsPage from '@/pages/ReportsPage'
import SettingsPage from '@/pages/SettingsPage'
import SponsorPortalPage from '@/pages/SponsorPortalPage'

function AuthenticatedRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/economy" element={<EconomyPage />} />
        <Route path="/sponsors" element={<SponsorsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

function UnauthenticatedRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/sponsor-portal" element={<SponsorPortalPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

function SetPasswordRoutes() {
  return (
    <Routes>
      <Route path="*" element={<SetPasswordPage />} />
    </Routes>
  )
}

export default function App() {
  const { session, profile, loading, isPasswordRecovery } = useAuthContext()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  const needsPassword = session && (isPasswordRecovery || profile?.has_password === false)

  return (
    <BrowserRouter>
      {!session ? (
        <UnauthenticatedRoutes />
      ) : needsPassword ? (
        <SetPasswordRoutes />
      ) : (
        <AuthenticatedRoutes />
      )}
    </BrowserRouter>
  )
}
