import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Building2,
  Users,
  Ticket,
  Calculator,
  Percent,
  Plug,
} from 'lucide-react'
import { useAuthContext } from '@/contexts/AuthContext'
import FestivalSettings from '@/components/settings/FestivalSettings'
import UserManagement from '@/components/settings/UserManagement'

const tabs = [
  { id: 'festival', icon: Building2, labelKey: 'settings.festival' },
  { id: 'users', icon: Users, labelKey: 'settings.users' },
  { id: 'ticket-categories', icon: Ticket, labelKey: 'settings.ticketCategories' },
  { id: 'budget', icon: Calculator, labelKey: 'settings.budgetPosts' },
  { id: 'vat', icon: Percent, labelKey: 'settings.vatRates' },
  { id: 'integrations', icon: Plug, labelKey: 'settings.integrations' },
] as const

type TabId = (typeof tabs)[number]['id']

export default function SettingsPage() {
  const { t } = useTranslation()
  const { profile } = useAuthContext()
  const [activeTab, setActiveTab] = useState<TabId>('festival')

  const isAdmin = profile?.role === 'admin'

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-1 border-b border-border">
        {tabs.map(({ id, icon: Icon, labelKey }) => {
          if (id === 'users' && !isAdmin) return null
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text-body'
              }`}
            >
              <Icon size={16} />
              {t(labelKey)}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="mt-6 max-w-3xl">
        {activeTab === 'festival' && <FestivalSettings />}
        {activeTab === 'users' && isAdmin && <UserManagement />}
        {activeTab === 'ticket-categories' && (
          <p className="text-text-muted">{t('settings.comingSoon')}</p>
        )}
        {activeTab === 'budget' && (
          <p className="text-text-muted">{t('settings.comingSoon')}</p>
        )}
        {activeTab === 'vat' && (
          <p className="text-text-muted">{t('settings.comingSoon')}</p>
        )}
        {activeTab === 'integrations' && (
          <p className="text-text-muted">{t('settings.comingSoon')}</p>
        )}
      </div>
    </div>
  )
}
