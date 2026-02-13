import { useTranslation } from 'react-i18next'

export default function SponsorsPage() {
  const { t } = useTranslation()

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('sponsors.title')}</h1>
    </div>
  )
}
