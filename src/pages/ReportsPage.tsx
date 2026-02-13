import { useTranslation } from 'react-i18next'

export default function ReportsPage() {
  const { t } = useTranslation()

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('reports.title')}</h1>
    </div>
  )
}
