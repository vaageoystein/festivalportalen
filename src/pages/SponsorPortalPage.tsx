import { useTranslation } from 'react-i18next'

export default function SponsorPortalPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">{t('sponsors.title')}</h1>
    </div>
  )
}
