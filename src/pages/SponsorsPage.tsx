import { useMemo, useEffect, useState, useCallback, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Handshake,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import { useAuthContext } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import type { Sponsor, SponsorDeliverable, SponsorLevel, SponsorStatus } from '@/types/database'

const LEVELS: SponsorLevel[] = ['hovedsponsor', 'gull', 'sølv', 'bronse', 'partner']
const STATUSES: SponsorStatus[] = ['contacted', 'agreed', 'signed', 'delivered', 'invoiced']

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const STATUS_COLORS: Record<SponsorStatus, string> = {
  contacted: 'bg-gray-100 text-gray-600',
  agreed: 'bg-blue-50 text-blue-600',
  signed: 'bg-indigo-50 text-indigo-600',
  delivered: 'bg-green-50 text-green-600',
  invoiced: 'bg-amber-50 text-amber-600',
}

export default function SponsorsPage() {
  const { t } = useTranslation()
  const { festival, profile } = useAuthContext()
  const currency = festival?.currency ?? 'NOK'
  const isAdmin = profile?.role === 'admin'

  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [deliverables, setDeliverables] = useState<SponsorDeliverable[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!festival) return
    const [sponRes, delRes] = await Promise.all([
      supabase
        .from('sponsors')
        .select('*')
        .eq('festival_id', festival.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('sponsor_deliverables')
        .select('*')
        .eq('festival_id', festival.id),
    ])
    if (sponRes.data) setSponsors(sponRes.data)
    if (delRes.data) setDeliverables(delRes.data)
    setLoading(false)
  }, [festival?.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useRealtimeTable('sponsors', festival?.id, fetchData)
  useRealtimeTable('sponsor_deliverables', festival?.id, fetchData)

  const totalAmount = useMemo(
    () => sponsors.reduce((s, sp) => s + (sp.agreement_amount ?? 0), 0),
    [sponsors],
  )

  const handleStatusChange = async (sponsorId: string, status: SponsorStatus) => {
    await supabase.from('sponsors').update({ status }).eq('id', sponsorId)
    await fetchData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('sponsors.deleteConfirm'))) return
    await supabase.from('sponsors').delete().eq('id', id)
    await fetchData()
  }

  const handleToggleDelivered = async (del: SponsorDeliverable) => {
    await supabase
      .from('sponsor_deliverables')
      .update({
        delivered: !del.delivered,
        delivered_at: !del.delivered ? new Date().toISOString() : null,
      })
      .eq('id', del.id)
    await fetchData()
  }

  const handleAddDeliverable = async (sponsorId: string, description: string) => {
    if (!festival) return
    await supabase.from('sponsor_deliverables').insert({
      sponsor_id: sponsorId,
      festival_id: festival.id,
      description,
    })
    await fetchData()
  }

  const handleDeleteDeliverable = async (id: string) => {
    await supabase.from('sponsor_deliverables').delete().eq('id', id)
    await fetchData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('sponsors.title')}</h1>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Plus size={16} />
            {t('sponsors.addSponsor')}
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        <SponsorForm
          festivalId={festival!.id}
          onSaved={() => {
            setShowForm(false)
            fetchData()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {sponsors.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
          <Handshake size={48} className="mx-auto text-primary" />
          <p className="mt-4 text-lg font-medium text-text-body">
            {t('sponsors.noData')}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {t('sponsors.noDataHint')}
          </p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center gap-3 text-text-muted">
                <Handshake size={18} />
                <span className="text-sm font-medium">{t('sponsors.totalSponsors')}</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-text-heading">{sponsors.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center gap-3 text-text-muted">
                <Handshake size={18} />
                <span className="text-sm font-medium">{t('sponsors.totalAmount')}</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-text-heading">
                {formatCurrency(totalAmount, currency)}
              </p>
            </div>
          </div>

          {/* Sponsor list */}
          <div className="space-y-3">
            {sponsors.map((sponsor) => {
              const isExpanded = expandedId === sponsor.id
              const sponsorDeliverables = deliverables.filter(
                (d) => d.sponsor_id === sponsor.id,
              )
              const deliveredCount = sponsorDeliverables.filter((d) => d.delivered).length

              return (
                <div
                  key={sponsor.id}
                  className="rounded-xl border border-border bg-surface shadow-sm"
                >
                  {/* Sponsor row */}
                  <div
                    className="flex cursor-pointer items-center gap-4 p-5"
                    onClick={() => setExpandedId(isExpanded ? null : sponsor.id)}
                  >
                    <button className="text-text-muted">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-text-heading">
                          {sponsor.name}
                        </span>
                        {sponsor.level && (
                          <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary">
                            {t(`sponsors.${sponsor.level}`, sponsor.level)}
                          </span>
                        )}
                      </div>
                      {sponsor.contact_name && (
                        <p className="mt-0.5 text-xs text-text-muted">
                          {sponsor.contact_name}
                          {sponsor.contact_email && ` · ${sponsor.contact_email}`}
                        </p>
                      )}
                    </div>

                    <div className="hidden items-center gap-4 sm:flex">
                      {sponsor.agreement_amount != null && (
                        <span className="text-sm font-medium text-text-body">
                          {formatCurrency(sponsor.agreement_amount, currency)}
                        </span>
                      )}
                      {isAdmin ? (
                        <select
                          value={sponsor.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            handleStatusChange(sponsor.id, e.target.value as SponsorStatus)
                          }
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[sponsor.status]}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {t(`sponsors.${s}`)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[sponsor.status]}`}
                        >
                          {t(`sponsors.${sponsor.status}`)}
                        </span>
                      )}
                      {sponsorDeliverables.length > 0 && (
                        <span className="text-xs text-text-muted">
                          {deliveredCount}/{sponsorDeliverables.length} {t('sponsors.deliverables').toLowerCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-border p-5">
                      <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                        {sponsor.contact_phone && (
                          <div>
                            <span className="text-xs font-medium text-text-muted">
                              {t('sponsors.contactPhone')}
                            </span>
                            <p className="text-text-body">{sponsor.contact_phone}</p>
                          </div>
                        )}
                        {sponsor.invoice_address && (
                          <div>
                            <span className="text-xs font-medium text-text-muted">
                              {t('sponsors.invoiceAddress')}
                            </span>
                            <p className="whitespace-pre-line text-text-body">
                              {sponsor.invoice_address}
                            </p>
                          </div>
                        )}
                        {sponsor.notes && (
                          <div>
                            <span className="text-xs font-medium text-text-muted">
                              {t('sponsors.notes')}
                            </span>
                            <p className="whitespace-pre-line text-text-body">
                              {sponsor.notes}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Deliverables */}
                      <div className="mt-4">
                        <h3 className="text-sm font-semibold text-text-heading">
                          {t('sponsors.deliverables')}
                        </h3>
                        {sponsorDeliverables.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {sponsorDeliverables.map((del) => (
                              <li
                                key={del.id}
                                className="flex items-center gap-2 text-sm"
                              >
                                {isAdmin ? (
                                  <button
                                    onClick={() => handleToggleDelivered(del)}
                                    className={
                                      del.delivered
                                        ? 'text-success'
                                        : 'text-text-muted hover:text-primary'
                                    }
                                  >
                                    {del.delivered ? (
                                      <CheckCircle2 size={16} />
                                    ) : (
                                      <Circle size={16} />
                                    )}
                                  </button>
                                ) : del.delivered ? (
                                  <CheckCircle2 size={16} className="text-success" />
                                ) : (
                                  <Circle size={16} className="text-text-muted" />
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
                                  <span className="text-xs text-text-muted">
                                    {new Date(del.delivered_at).toLocaleDateString('nb-NO')}
                                  </span>
                                )}
                                {isAdmin && (
                                  <button
                                    onClick={() => handleDeleteDeliverable(del.id)}
                                    className="ml-auto text-text-muted hover:text-danger"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        {isAdmin && (
                          <AddDeliverableInline
                            onAdd={(desc) => handleAddDeliverable(sponsor.id, desc)}
                          />
                        )}
                      </div>

                      {isAdmin && (
                        <div className="mt-4 border-t border-border-light pt-3">
                          <button
                            onClick={() => handleDelete(sponsor.id)}
                            className="flex items-center gap-1 text-xs text-text-muted hover:text-danger"
                          >
                            <Trash2 size={12} />
                            {t('common.delete')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// --- Inline add deliverable ---

function AddDeliverableInline({ onAdd }: { onAdd: (desc: string) => void }) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    onAdd(value.trim())
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('sponsors.deliverableDescription')}
        className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-body placeholder-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <button
        type="submit"
        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark"
      >
        <Plus size={14} />
      </button>
    </form>
  )
}

// --- Sponsor Form ---

function SponsorForm({
  festivalId,
  onSaved,
  onCancel,
}: {
  festivalId: string
  onSaved: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const form = e.target as HTMLFormElement
    const data = new FormData(form)

    await supabase.from('sponsors').insert({
      festival_id: festivalId,
      name: data.get('name') as string,
      level: (data.get('level') as SponsorLevel) || null,
      contact_name: (data.get('contact_name') as string) || null,
      contact_email: (data.get('contact_email') as string) || null,
      contact_phone: (data.get('contact_phone') as string) || null,
      invoice_address: (data.get('invoice_address') as string) || null,
      agreement_amount: parseFloat(data.get('agreement_amount') as string) || null,
      notes: (data.get('notes') as string) || null,
      status: 'contacted',
    })

    setSaving(false)
    onSaved()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-surface p-5 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-text-muted">
            {t('sponsors.name')} *
          </label>
          <input
            name="name"
            type="text"
            required
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted">
            {t('sponsors.level')}
          </label>
          <select
            name="level"
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">—</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {t(`sponsors.${l}`, l)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted">
            {t('sponsors.agreementAmount')}
          </label>
          <input
            name="agreement_amount"
            type="number"
            step="0.01"
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted">
            {t('sponsors.contactName')}
          </label>
          <input
            name="contact_name"
            type="text"
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted">
            {t('sponsors.contactEmail')}
          </label>
          <input
            name="contact_email"
            type="email"
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
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-text-muted">
            {t('sponsors.invoiceAddress')}
          </label>
          <input
            name="invoice_address"
            type="text"
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted">
            {t('sponsors.notes')}
          </label>
          <input
            name="notes"
            type="text"
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? t('common.loading') : t('common.save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-body hover:bg-surface-hover"
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}
