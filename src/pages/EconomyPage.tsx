import { useMemo, useEffect, useState, useCallback, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  TrendingUp,
  Wallet,
  Download,
  Plus,
  Trash2,
  MinusCircle,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useAuthContext } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import { exportEconomyCsv } from '@/lib/export-csv'
import type { Income, Expense } from '@/types/database'

const INCOME_CATEGORIES = [
  'billetter',
  'sponsor',
  'tilskudd',
  'bar_mat',
  'merch',
  'annet',
] as const

const EXPENSE_CATEGORIES = [
  'artist',
  'produksjon',
  'markedsforing',
  'leie',
  'forsikring',
  'admin',
  'annet',
] as const

const VAT_RATES = [
  { value: 0.25, label: '25%' },
  { value: 0.15, label: '15%' },
  { value: 0.12, label: '12%' },
  { value: 0, label: '0%' },
]

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function StatCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string
  value: string
  color: 'default' | 'success' | 'danger' | 'warning'
  icon: React.ElementType
}) {
  const colorClass = {
    default: 'text-text-heading',
    success: 'text-success',
    danger: 'text-danger',
    warning: 'text-warning',
  }[color]

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-3 text-text-muted">
        <Icon size={18} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  )
}

export default function EconomyPage() {
  const { t } = useTranslation()
  const { festival, profile } = useAuthContext()
  const currency = festival?.currency ?? 'NOK'
  const isAdmin = profile?.role === 'admin'

  const [income, setIncome] = useState<Income[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)

  const fetchData = useCallback(async () => {
    if (!festival) return
    const [incRes, expRes] = await Promise.all([
      supabase
        .from('income')
        .select('*')
        .eq('festival_id', festival.id)
        .order('date', { ascending: false }),
      supabase
        .from('expenses')
        .select('*')
        .eq('festival_id', festival.id)
        .order('date', { ascending: false }),
    ])
    if (incRes.data) setIncome(incRes.data)
    if (expRes.data) setExpenses(expRes.data)
    setLoading(false)
  }, [festival?.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useRealtimeTable('income', festival?.id, fetchData)
  useRealtimeTable('expenses', festival?.id, fetchData)

  // Aggregates
  const actualIncome = useMemo(
    () => income.filter((i) => !i.is_budget),
    [income],
  )
  const actualExpenses = useMemo(
    () => expenses.filter((e) => !e.is_budget),
    [expenses],
  )
  const totalActualIncome = useMemo(
    () => actualIncome.reduce((s, i) => s + (i.amount_ex_vat ?? 0), 0),
    [actualIncome],
  )
  const totalActualExpenses = useMemo(
    () => actualExpenses.reduce((s, e) => s + (e.amount_ex_vat ?? 0), 0),
    [actualExpenses],
  )
  const result = totalActualIncome - totalActualExpenses
  const resultColor =
    result > totalActualIncome * 0.05
      ? 'success' as const
      : result < -totalActualIncome * 0.05
        ? 'danger' as const
        : 'warning' as const

  // Budget vs actual chart
  const budgetVsActual = useMemo(() => {
    const categories = new Map<
      string,
      { category: string; budget: number; actual: number }
    >()

    for (const i of income) {
      const cat = i.category
      const existing = categories.get(`inc-${cat}`) ?? {
        category: t(`economy.incomeCategories.${cat}`, cat),
        budget: 0,
        actual: 0,
      }
      if (i.is_budget) existing.budget += i.amount_ex_vat ?? 0
      else existing.actual += i.amount_ex_vat ?? 0
      categories.set(`inc-${cat}`, existing)
    }

    for (const e of expenses) {
      const cat = e.category
      const existing = categories.get(`exp-${cat}`) ?? {
        category: t(`economy.expenseCategories.${cat}`, cat),
        budget: 0,
        actual: 0,
      }
      if (e.is_budget) existing.budget += e.amount_ex_vat ?? 0
      else existing.actual += e.amount_ex_vat ?? 0
      categories.set(`exp-${cat}`, existing)
    }

    return Array.from(categories.values())
  }, [income, expenses, t])

  // VAT summary
  const vatSummary = useMemo(() => {
    const byRate = new Map<number, { rate: number; exVat: number; vat: number }>()

    const allItems = [
      ...actualIncome.map((i) => ({
        exVat: i.amount_ex_vat ?? 0,
        vatRate: i.vat_rate ?? 0,
        vatAmount: i.vat_amount ?? (i.amount_ex_vat ?? 0) * (i.vat_rate ?? 0),
      })),
      ...actualExpenses.map((e) => ({
        exVat: e.amount_ex_vat ?? 0,
        vatRate: e.vat_rate ?? 0,
        vatAmount: e.vat_amount ?? (e.amount_ex_vat ?? 0) * (e.vat_rate ?? 0),
      })),
    ]

    for (const item of allItems) {
      const existing = byRate.get(item.vatRate) ?? {
        rate: item.vatRate,
        exVat: 0,
        vat: 0,
      }
      existing.exVat += item.exVat
      existing.vat += item.vatAmount
      byRate.set(item.vatRate, existing)
    }

    return Array.from(byRate.values()).sort((a, b) => b.rate - a.rate)
  }, [actualIncome, actualExpenses])

  const handleDeleteIncome = async (id: string) => {
    if (!confirm(t('economy.deleteConfirm'))) return
    await supabase.from('income').delete().eq('id', id)
    await fetchData()
  }

  const handleDeleteExpense = async (id: string) => {
    if (!confirm(t('economy.deleteConfirm'))) return
    await supabase.from('expenses').delete().eq('id', id)
    await fetchData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  const hasData = income.length > 0 || expenses.length > 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('economy.title')}</h1>
        {hasData && (
          <button
            onClick={() =>
              exportEconomyCsv(
                income,
                expenses,
                `okonomi-${new Date().toISOString().slice(0, 10)}.csv`,
              )
            }
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body hover:bg-surface-hover"
          >
            <Download size={16} />
            {t('economy.exportEconomy')}
          </button>
        )}
      </div>

      {!hasData ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
          <Wallet size={48} className="mx-auto text-primary" />
          <p className="mt-4 text-lg font-medium text-text-body">
            {t('economy.noData')}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {t('economy.noDataHint')}
          </p>
          {isAdmin && (
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => setShowIncomeForm(true)}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
              >
                <Plus size={16} />
                {t('economy.addIncome')}
              </button>
              <button
                onClick={() => setShowExpenseForm(true)}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-body hover:bg-surface-hover"
              >
                <Plus size={16} />
                {t('economy.addExpense')}
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={TrendingUp}
              label={t('economy.income')}
              value={formatCurrency(totalActualIncome, currency)}
              color="success"
            />
            <StatCard
              icon={MinusCircle}
              label={t('economy.expenses')}
              value={formatCurrency(totalActualExpenses, currency)}
              color="danger"
            />
            <StatCard
              icon={Wallet}
              label={t('economy.result')}
              value={formatCurrency(result, currency)}
              color={resultColor}
            />
          </div>

          {/* Budget vs actual chart */}
          {budgetVsActual.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">
                {t('dashboard.budgetVsActual')}
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={budgetVsActual}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                  <XAxis
                    dataKey="category"
                    stroke="#A8A29E"
                    fontSize={12}
                    tick={{ fill: '#44403C' }}
                  />
                  <YAxis stroke="#A8A29E" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E7E5E4',
                      borderRadius: 8,
                    }}
                    formatter={(value: number) => formatCurrency(value, currency)}
                  />
                  <Legend />
                  <Bar
                    dataKey="budget"
                    name={t('economy.budget')}
                    fill="#A8A29E"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="actual"
                    name={t('economy.actual')}
                    fill="#6366F1"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* VAT summary */}
          {vatSummary.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">
                {t('economy.vatSummary')}
              </h2>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-text-muted">
                    <th className="pb-3 pr-4 font-medium">{t('economy.vatRate')}</th>
                    <th className="pb-3 pr-4 text-right font-medium">
                      {t('economy.totalExVat')}
                    </th>
                    <th className="pb-3 pr-4 text-right font-medium">
                      {t('economy.totalVat')}
                    </th>
                    <th className="pb-3 text-right font-medium">
                      {t('economy.totalIncVat')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {vatSummary.map((v) => (
                    <tr key={v.rate}>
                      <td className="py-3 pr-4 text-text-body">
                        {(v.rate * 100).toFixed(0)}%
                      </td>
                      <td className="py-3 pr-4 text-right text-text-body">
                        {formatCurrency(v.exVat, currency)}
                      </td>
                      <td className="py-3 pr-4 text-right text-text-body">
                        {formatCurrency(v.vat, currency)}
                      </td>
                      <td className="py-3 text-right text-text-body">
                        {formatCurrency(v.exVat + v.vat, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Income section */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('economy.income')}</h2>
              {isAdmin && (
                <button
                  onClick={() => setShowIncomeForm(!showIncomeForm)}
                  className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark"
                >
                  <Plus size={14} />
                  {t('economy.addIncome')}
                </button>
              )}
            </div>

            {showIncomeForm && isAdmin && (
              <IncomeForm
                festivalId={festival!.id}
                onSaved={() => {
                  setShowIncomeForm(false)
                  fetchData()
                }}
                onCancel={() => setShowIncomeForm(false)}
              />
            )}

            {income.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-text-muted">
                      <th className="pb-3 pr-4 font-medium">{t('economy.date')}</th>
                      <th className="pb-3 pr-4 font-medium">
                        {t('economy.category')}
                      </th>
                      <th className="pb-3 pr-4 font-medium">
                        {t('economy.description')}
                      </th>
                      <th className="pb-3 pr-4 text-right font-medium">
                        {t('economy.amountExVat')}
                      </th>
                      <th className="pb-3 pr-4 font-medium">{t('economy.vat')}</th>
                      <th className="pb-3 pr-4 font-medium">{t('economy.source')}</th>
                      <th className="pb-3 font-medium">{t('economy.budget')}/{t('economy.actual')}</th>
                      {isAdmin && <th className="pb-3" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {income.map((i) => (
                      <tr key={i.id}>
                        <td className="py-3 pr-4 text-text-body">{i.date ?? '—'}</td>
                        <td className="py-3 pr-4 text-text-body">
                          {t(`economy.incomeCategories.${i.category}`, i.category)}
                        </td>
                        <td className="py-3 pr-4 text-text-body">
                          {i.description ?? '—'}
                        </td>
                        <td className="py-3 pr-4 text-right text-text-body">
                          {formatCurrency(i.amount_ex_vat ?? 0, currency)}
                        </td>
                        <td className="py-3 pr-4 text-text-body">
                          {i.vat_rate ? `${(i.vat_rate * 100).toFixed(0)}%` : '—'}
                        </td>
                        <td className="py-3 pr-4 text-text-body">{i.source ?? '—'}</td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              i.is_budget
                                ? 'bg-gray-100 text-text-muted'
                                : 'bg-primary-light text-primary'
                            }`}
                          >
                            {i.is_budget ? t('economy.budget') : t('economy.actual')}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="py-3">
                            <button
                              onClick={() => handleDeleteIncome(i.id)}
                              className="text-text-muted hover:text-danger"
                              title={t('common.delete')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Expenses section */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('economy.expenses')}</h2>
              {isAdmin && (
                <button
                  onClick={() => setShowExpenseForm(!showExpenseForm)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-body hover:bg-surface-hover"
                >
                  <Plus size={14} />
                  {t('economy.addExpense')}
                </button>
              )}
            </div>

            {showExpenseForm && isAdmin && (
              <ExpenseForm
                festivalId={festival!.id}
                onSaved={() => {
                  setShowExpenseForm(false)
                  fetchData()
                }}
                onCancel={() => setShowExpenseForm(false)}
              />
            )}

            {expenses.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-text-muted">
                      <th className="pb-3 pr-4 font-medium">{t('economy.date')}</th>
                      <th className="pb-3 pr-4 font-medium">
                        {t('economy.category')}
                      </th>
                      <th className="pb-3 pr-4 font-medium">
                        {t('economy.description')}
                      </th>
                      <th className="pb-3 pr-4 text-right font-medium">
                        {t('economy.amountExVat')}
                      </th>
                      <th className="pb-3 pr-4 font-medium">{t('economy.vat')}</th>
                      <th className="pb-3 pr-4 font-medium">
                        {t('economy.supplier')}
                      </th>
                      <th className="pb-3 font-medium">{t('economy.budget')}/{t('economy.actual')}</th>
                      {isAdmin && <th className="pb-3" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {expenses.map((e) => (
                      <tr key={e.id}>
                        <td className="py-3 pr-4 text-text-body">{e.date ?? '—'}</td>
                        <td className="py-3 pr-4 text-text-body">
                          {t(`economy.expenseCategories.${e.category}`, e.category)}
                        </td>
                        <td className="py-3 pr-4 text-text-body">
                          {e.description ?? '—'}
                        </td>
                        <td className="py-3 pr-4 text-right text-text-body">
                          {formatCurrency(e.amount_ex_vat ?? 0, currency)}
                        </td>
                        <td className="py-3 pr-4 text-text-body">
                          {e.vat_rate ? `${(e.vat_rate * 100).toFixed(0)}%` : '—'}
                        </td>
                        <td className="py-3 pr-4 text-text-body">
                          {e.supplier ?? '—'}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              e.is_budget
                                ? 'bg-gray-100 text-text-muted'
                                : 'bg-primary-light text-primary'
                            }`}
                          >
                            {e.is_budget ? t('economy.budget') : t('economy.actual')}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="py-3">
                            <button
                              onClick={() => handleDeleteExpense(e.id)}
                              className="text-text-muted hover:text-danger"
                              title={t('common.delete')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// --- Income Form ---

function IncomeForm({
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

    const amountExVat = parseFloat(data.get('amount_ex_vat') as string) || 0
    const vatRate = parseFloat(data.get('vat_rate') as string) || 0
    const vatAmount = amountExVat * vatRate

    await supabase.from('income').insert({
      festival_id: festivalId,
      category: data.get('category') as string,
      description: (data.get('description') as string) || null,
      amount_ex_vat: amountExVat,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      source: (data.get('source') as string) || null,
      is_budget: data.get('is_budget') === 'true',
      date: (data.get('date') as string) || null,
    })

    setSaving(false)
    onSaved()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-border bg-bg p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div>
        <label className="block text-xs font-medium text-text-muted">
          {t('economy.category')}
        </label>
        <select
          name="category"
          required
          className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {INCOME_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {t(`economy.incomeCategories.${cat}`)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted">
          {t('economy.description')}
        </label>
        <input
          name="description"
          type="text"
          className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted">
          {t('economy.amountExVat')}
        </label>
        <input
          name="amount_ex_vat"
          type="number"
          step="0.01"
          required
          className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted">
          {t('economy.vatRate')}
        </label>
        <select
          name="vat_rate"
          className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {VAT_RATES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted">
          {t('economy.source')}
        </label>
        <input
          name="source"
          type="text"
          className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted">
          {t('economy.date')}
        </label>
        <input
          name="date"
          type="date"
          className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted">
          {t('economy.budget')}/{t('economy.actual')}
        </label>
        <select
          name="is_budget"
          className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="false">{t('economy.actual')}</option>
          <option value="true">{t('economy.budget')}</option>
        </select>
      </div>
      <div className="flex items-end gap-2">
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

// --- Expense Form ---

function ExpenseForm({
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

    const amountExVat = parseFloat(data.get('amount_ex_vat') as string) || 0
    const vatRate = parseFloat(data.get('vat_rate') as string) || 0
    const vatAmount = amountExVat * vatRate

    await supabase.from('expenses').insert({
      festival_id: festivalId,
      category: data.get('category') as string,
      description: (data.get('description') as string) || null,
      amount_ex_vat: amountExVat,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      supplier: (data.get('supplier') as string) || null,
      is_budget: data.get('is_budget') === 'true',
      date: (data.get('date') as string) || null,
    })

    setSaving(false)
    onSaved()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-border bg-bg p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div>
        <label className="block text-xs font-medium text-text-muted">
          {t('economy.category')}
        </label>
        <select
          name="category"
          required
          className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {EXPENSE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {t(`economy.expenseCategories.${cat}`)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted">
          {t('economy.description')}
        </label>
        <input
          name="description"
          type="text"
          className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted">
          {t('economy.amountExVat')}
        </label>
        <input
          name="amount_ex_vat"
          type="number"
          step="0.01"
          required
          className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted">
          {t('economy.vatRate')}
        </label>
        <select
          name="vat_rate"
          className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {VAT_RATES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted">
          {t('economy.supplier')}
        </label>
        <input
          name="supplier"
          type="text"
          className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted">
          {t('economy.date')}
        </label>
        <input
          name="date"
          type="date"
          className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted">
          {t('economy.budget')}/{t('economy.actual')}
        </label>
        <select
          name="is_budget"
          className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="false">{t('economy.actual')}</option>
          <option value="true">{t('economy.budget')}</option>
        </select>
      </div>
      <div className="flex items-end gap-2">
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
