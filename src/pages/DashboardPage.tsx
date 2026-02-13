import { useTranslation } from 'react-i18next'

export default function DashboardPage() {
  const { t } = useTranslation()

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
      <p className="mt-2 text-text-muted">{t('app.tagline')}</p>
    </div>
  )
}
