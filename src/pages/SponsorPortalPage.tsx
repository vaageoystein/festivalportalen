import { useEffect, useState, useCallback, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Circle, Handshake } from 'lucide-react'
import { useAuthContext } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Sponsor, SponsorDeliverable } from '@/types/database'

export default function SponsorPortalPage() {
  const { t } = useTranslation()
  const { session, profile, festival } = useAuthContext()

  const [sponsor, setSponsor] = useState<Sponsor | null>(null)
  const [deliverables, setDeliverables] = useState<SponsorDeliverable[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const isSponsor = profile?.role === 'sponsor'

  const fetchSponsor = useCallback(async () => {
    if (!session || !profile || !isSponsor) {
      setLoading(false)
      return
    }
    // Find the sponsor matching the user's email
    const email = session.user.email
    if (!email) {
      setLoading(false)
      return
    }
    const { data: sponsorData } = await supabase
      .from('sponsors')
      .select('*')
      .eq('festival_id', profile.festival_id)
      .eq('contact_email', email)
      .limit(1)
      .maybeSingle()

    if (sponsorData) {
      setSponsor(sponsorData)
      const { data: delData } = await supabase
        .from('sponsor_deliverables')
        .select('*')
        .eq('sponsor_id', sponsorData.id)
      if (delData) setDeliverables(delData)
    }
    setLoading(false)
  }, [session, profile, isSponsor])

  useEffect(() => {
    fetchSponsor()
  }, [fetchSponsor])

  const handleUpdateInfo = async (e: FormEvent) => {
    e.preventDefault()
    if (!sponsor) return
    setSaving(true)
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    await supabase
      .from('sponsors')
      .update({
        contact_name: (data.get('contact_name') as string) || null,
        contact_phone: (data.get('contact_phone') as string) || null,
        invoice_address: (data.get('invoice_address') as string) || null,
      })
      .eq('id', sponsor.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    await fetchSponsor()
  }

  // No access — user not logged in or not a sponsor role
  if (!session || !isSponsor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
          <Handshake size={48} className="mx-auto text-primary" />
          <h1 className="mt-4 text-xl font-bold text-text-heading">
            {t('sponsors.portalTitle')}
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {t('sponsors.noPortalAccess')}
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  if (!sponsor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
          <Handshake size={48} className="mx-auto text-primary" />
          <h1 className="mt-4 text-xl font-bold text-text-heading">
            {t('sponsors.portalTitle')}
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {t('sponsors.noPortalAccess')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-3xl p-6">
        {/* Header */}
        <div className="mb-8 text-center">
          {festival?.logo_url && (
            <img
              src={festival.logo_url}
              alt={festival.name}
              className="mx-auto mb-4 h-16"
            />
          )}
          <h1 className="text-2xl font-bold text-text-heading">
            {t('sponsors.portalTitle')}
          </h1>
          <p className="mt-1 text-text-muted">
            {t('sponsors.portalWelcome')}, {sponsor.name}
          </p>
        </div>

        {/* Deliverables */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-text-heading">
            {t('sponsors.yourDeliverables')}
          </h2>
          {deliverables.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">
              {t('sponsors.noData')}
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {deliverables.map((del) => (
                <li key={del.id} className="flex items-center gap-3 text-sm">
                  {del.delivered ? (
                    <CheckCircle2 size={18} className="flex-shrink-0 text-success" />
                  ) : (
                    <Circle size={18} className="flex-shrink-0 text-text-muted" />
                  )}
                  <span
                    className={
                      del.delivered
                        ? 'text-text-muted line-through'
                        : 'text-text-body'
                    }
                  >
                    {del.description}
                  </span>
                  {del.delivered && del.delivered_at && (
                    <span className="ml-auto text-xs text-text-muted">
                      {new Date(del.delivered_at).toLocaleDateString('nb-NO')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Update contact info */}
        <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-text-heading">
            {t('sponsors.updateInfo')}
          </h2>
          <form onSubmit={handleUpdateInfo} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-muted">
                {t('sponsors.contactName')}
              </label>
              <input
                name="contact_name"
                type="text"
                defaultValue={sponsor.contact_name ?? ''}
                className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted">
                {t('sponsors.contactPhone')}
              </label>
              <input
                name="contact_phone"
                type="tel"
                defaultValue={sponsor.contact_phone ?? ''}
                className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted">
                {t('sponsors.invoiceAddress')}
              </label>
              <textarea
                name="invoice_address"
                rows={3}
                defaultValue={sponsor.invoice_address ?? ''}
                className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {saving ? t('common.loading') : t('common.save')}
              </button>
              {saved && (
                <span className="text-sm text-success">{t('settings.saved')}</span>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
