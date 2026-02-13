import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthContext } from '@/contexts/AuthContext'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
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

export default function App() {
  const { session, loading } = useAuthContext()
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-slate-400">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center">
            <p className="text-slate-400">{t('common.loading')}</p>
          </div>
        }
      >
        {session ? <AuthenticatedRoutes /> : <UnauthenticatedRoutes />}
      </Suspense>
    </BrowserRouter>
  )
}
