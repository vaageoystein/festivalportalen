import { useTranslation } from 'react-i18next'

export default function EconomyPage() {
  const { t } = useTranslation()

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('economy.title')}</h1>
    </div>
  )
}
