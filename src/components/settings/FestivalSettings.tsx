import { useState, useEffect, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/contexts/AuthContext'
import type { Festival } from '@/types/database'

const LOCALES = [
  { value: 'nb', label: 'Norsk bokmål' },
  { value: 'nn', label: 'Nynorsk' },
  { value: 'en', label: 'English' },
]

const CURRENCIES = ['NOK', 'SEK', 'EUR', 'DKK', 'GBP']

export default function FestivalSettings() {
  const { t } = useTranslation()
  const { festival, refreshFestival } = useAuthContext()
  const [form, setForm] = useState<Partial<Festival>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (festival) {
      setForm(festival)
    }
  }, [festival])

  const update = (field: keyof Festival, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  const handleLogoUpload = async (file: File) => {
    if (!festival) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `festivals/${festival.id}/logo.${ext}`

    await supabase.storage.from('assets').upload(path, file, { upsert: true })

    const { data } = supabase.storage.from('assets').getPublicUrl(path)
    update('logo_url', data.publicUrl)
    setUploading(false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!festival) return
    setSaving(true)

    const { id: _id, created_at: _created, ...updates } = form
    await supabase.from('festivals').update(updates).eq('id', festival.id)

    await refreshFestival()
    setSaving(false)
    setSaved(true)
  }

  if (!festival) return null

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-text-body">
          {t('settings.festivalName')}
        </label>
        <input
          type="text"
          value={form.name ?? ''}
          onChange={(e) => update('name', e.target.value)}
          className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Logo */}
      <div>
        <label className="block text-sm font-medium text-text-body">
          {t('settings.logo')}
        </label>
        <div className="mt-1 flex items-center gap-4">
          {form.logo_url && (
            <img
              src={form.logo_url}
              alt="Logo"
              className="h-16 w-16 rounded-lg object-contain p-1"
            />
          )}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-hover px-4 py-2 text-sm text-text-body hover:bg-border-light">
            <Upload size={16} />
            {uploading ? t('common.loading') : t('settings.uploadLogo')}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleLogoUpload(file)
              }}
            />
          </label>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-text-body">
            {t('settings.startDate')}
          </label>
          <input
            type="date"
            value={form.start_date ?? ''}
            onChange={(e) => update('start_date', e.target.value || null)}
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-body">
            {t('settings.endDate')}
          </label>
          <input
            type="date"
            value={form.end_date ?? ''}
            onChange={(e) => update('end_date', e.target.value || null)}
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Location + Website */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-text-body">
            {t('settings.location')}
          </label>
          <input
            type="text"
            value={form.location ?? ''}
            onChange={(e) => update('location', e.target.value || null)}
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-body">
            {t('settings.website')}
          </label>
          <input
            type="url"
            value={form.website ?? ''}
            onChange={(e) => update('website', e.target.value || null)}
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Capacity */}
      <div>
        <label className="block text-sm font-medium text-text-body">
          {t('settings.capacity')}
        </label>
        <input
          type="number"
          value={form.capacity ?? ''}
          onChange={(e) =>
            update('capacity', e.target.value ? Number(e.target.value) : null)
          }
          className="mt-1 block w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Language + Currency */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-text-body">
            {t('settings.defaultLanguage')}
          </label>
          <select
            value={form.default_locale ?? 'nb'}
            onChange={(e) => update('default_locale', e.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {LOCALES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-body">
            {t('settings.currency')}
          </label>
          <select
            value={form.currency ?? 'NOK'}
            onChange={(e) => update('currency', e.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? t('common.loading') : t('common.save')}
        </button>
        {saved && (
          <span className="text-sm text-success">{t('settings.saved')}</span>
        )}
      </div>
    </form>
  )
}
