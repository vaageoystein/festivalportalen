import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileSpreadsheet, Calendar } from 'lucide-react'
import { useAuthContext } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  exportAccountingTicketsCsv,
  exportAccountingVatCsv,
  exportAccountingSummaryCsv,
  exportEconomyCsv,
  groupSalesByVat,
} from '@/lib/export-csv'
import type { TicketSale, Income, Expense } from '@/types/database'

type Tab = 'accounting' | 'sponsor' | 'annual'

export default function ReportsPage() {
  const { t } = useTranslation()
  const { festival } = useAuthContext()
  const currency = festival?.currency ?? 'NOK'

  const [tab, setTab] = useState<Tab>('accounting')
  const [sales, setSales] = useState<TicketSale[]>([])
  const [income, setIncome] = useState<Income[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchData = useCallback(async () => {
    if (!festival) return
    const [salesRes, incRes, expRes] = await Promise.all([
      supabase
        .from('ticket_sales')
        .select('*')
        .eq('festival_id', festival.id)
        .order('sold_at', { ascending: true }),
      supabase
        .from('income')
        .select('*')
        .eq('festival_id', festival.id)
        .eq('is_budget', false),
      supabase
        .from('expenses')
        .select('*')
        .eq('festival_id', festival.id)
        .eq('is_budget', false),
    ])
    if (salesRes.data) setSales(salesRes.data)
    if (incRes.data) setIncome(incRes.data)
    if (expRes.data) setExpenses(expRes.data)
    setLoading(false)
  }, [festival?.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter data by date range
  const filteredSales = useMemo(() => {
    let result = sales
    if (dateFrom) result = result.filter((s) => (s.sold_at ?? '') >= dateFrom)
    if (dateTo) result = result.filter((s) => (s.sold_at ?? '') <= dateTo + 'T23:59:59')
    return result
  }, [sales, dateFrom, dateTo])

  const filteredIncome = useMemo(() => {
    let result = income
    if (dateFrom) result = result.filter((i) => (i.date ?? '') >= dateFrom)
    if (dateTo) result = result.filter((i) => (i.date ?? '') <= dateTo)
    return result
  }, [income, dateFrom, dateTo])

  const filteredExpenses = useMemo(() => {
    let result = expenses
    if (dateFrom) result = result.filter((e) => (e.date ?? '') >= dateFrom)
    if (dateTo) result = result.filter((e) => (e.date ?? '') <= dateTo)
    return result
  }, [expenses, dateFrom, dateTo])

  const tickets = useMemo(
    () => filteredSales.filter((s) => s.category !== 'fb'),
    [filteredSales],
  )
  const fnb = useMemo(
    () => filteredSales.filter((s) => s.category === 'fb'),
    [filteredSales],
  )
  const vatBuckets = useMemo(() => groupSalesByVat(filteredSales), [filteredSales])

  const fmt = (n: number) =>
    new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n)

  const totalTicketInc = tickets.reduce(
    (s, r) => s + (r.price_inc_vat ?? 0) * r.quantity,
    0,
  )
  const totalFnbInc = fnb.reduce(
    (s, r) => s + (r.price_inc_vat ?? 0) * r.quantity,
    0,
  )
  const totalIncomeAmt = filteredIncome.reduce(
    (s, i) => s + (i.amount_ex_vat ?? 0) + (i.vat_amount ?? (i.amount_ex_vat ?? 0) * (i.vat_rate ?? 0)),
    0,
  )
  const totalExpensesAmt = filteredExpenses.reduce(
    (s, e) => s + (e.amount_ex_vat ?? 0) + (e.vat_amount ?? (e.amount_ex_vat ?? 0) * (e.vat_rate ?? 0)),
    0,
  )

  const tabs: { key: Tab; label: string }[] = [
    { key: 'accounting', label: t('reports.accountingExport') },
    { key: 'sponsor', label: t('reports.sponsorReport') },
    { key: 'annual', label: t('reports.annualReport') },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{t('reports.title')}</h1>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-surface-alt p-1">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === tb.key
                ? 'bg-surface text-text-heading shadow-sm'
                : 'text-text-muted hover:text-text-body'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'accounting' && (
        <AccountingExportTab
          t={t}
          fmt={fmt}
          dateFrom={dateFrom}
          dateTo={dateTo}
          setDateFrom={setDateFrom}
          setDateTo={setDateTo}
          filteredSales={filteredSales}
          filteredIncome={filteredIncome}
          filteredExpenses={filteredExpenses}
          tickets={tickets}
          fnb={fnb}
          vatBuckets={vatBuckets}
          totalTicketInc={totalTicketInc}
          totalFnbInc={totalFnbInc}
          totalIncomeAmt={totalIncomeAmt}
          totalExpensesAmt={totalExpensesAmt}
        />
      )}

      {tab === 'sponsor' && (
        <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
          <FileSpreadsheet size={48} className="mx-auto text-primary" />
          <p className="mt-4 text-lg font-medium text-text-body">
            {t('reports.sponsorReport')}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {t('settings.comingSoon')}
          </p>
        </div>
      )}

      {tab === 'annual' && (
        <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
          <FileSpreadsheet size={48} className="mx-auto text-primary" />
          <p className="mt-4 text-lg font-medium text-text-body">
            {t('reports.annualReport')}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {t('settings.comingSoon')}
          </p>
        </div>
      )}
    </div>
  )
}

// --- Accounting Export Tab ---

function AccountingExportTab({
  t,
  fmt,
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
  filteredSales,
  filteredIncome,
  filteredExpenses,
  tickets,
  fnb,
  vatBuckets,
  totalTicketInc,
  totalFnbInc,
  totalIncomeAmt,
  totalExpensesAmt,
}: {
  t: (key: string) => string
  fmt: (n: number) => string
  dateFrom: string
  dateTo: string
  setDateFrom: (v: string) => void
  setDateTo: (v: string) => void
  filteredSales: TicketSale[]
  filteredIncome: Income[]
  filteredExpenses: Expense[]
  tickets: TicketSale[]
  fnb: TicketSale[]
  vatBuckets: { rate: number; label: string; exVat: number; vatAmount: number; incVat: number; count: number }[]
  totalTicketInc: number
  totalFnbInc: number
  totalIncomeAmt: number
  totalExpensesAmt: number
}) {
  const slug = dateFrom && dateTo ? `${dateFrom}_${dateTo}` : 'total'

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-muted">{t('reports.accountingDesc')}</p>

      {/* Date filter */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <Calendar size={18} className="mb-2 text-text-muted" />
        <div>
          <label className="block text-xs font-medium text-text-muted">
            {t('reports.dateFrom')}
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted">
            {t('reports.dateTo')}
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => {
              setDateFrom('')
              setDateTo('')
            }}
            className="text-xs text-text-muted hover:text-primary"
          >
            {t('reports.allTime')}
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label={t('reports.totalTickets')}
          value={fmt(totalTicketInc)}
          sub={`${tickets.reduce((s, r) => s + r.quantity, 0)} ${t('sales.tickets').toLowerCase()}`}
        />
        <SummaryCard
          label={t('reports.totalFnb')}
          value={fmt(totalFnbInc)}
          sub={`${fnb.reduce((s, r) => s + r.quantity, 0)} ${t('sales.items')}`}
        />
        <SummaryCard
          label={t('reports.totalIncome')}
          value={fmt(totalIncomeAmt)}
          sub={`${filteredIncome.length} ${t('reports.rows')}`}
        />
        <SummaryCard
          label={t('reports.totalExpenses')}
          value={fmt(totalExpensesAmt)}
          sub={`${filteredExpenses.length} ${t('reports.rows')}`}
        />
      </div>

      {/* VAT overview table */}
      {vatBuckets.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-text-heading">
            {t('reports.vatOverview')}
          </h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="pb-2 pr-4">{t('economy.vat')}</th>
                  <th className="pb-2 pr-4 text-right">{t('economy.totalExVat')}</th>
                  <th className="pb-2 pr-4 text-right">{t('economy.totalVat')}</th>
                  <th className="pb-2 text-right">{t('economy.totalIncVat')}</th>
                </tr>
              </thead>
              <tbody>
                {vatBuckets.map((b) => (
                  <tr key={b.rate} className="border-b border-border-light">
                    <td className="py-2 pr-4 font-medium text-text-body">
                      {b.label}
                    </td>
                    <td className="py-2 pr-4 text-right text-text-body">
                      {fmt(b.exVat)}
                    </td>
                    <td className="py-2 pr-4 text-right text-text-body">
                      {fmt(b.vatAmount)}
                    </td>
                    <td className="py-2 text-right font-medium text-text-heading">
                      {fmt(b.incVat)}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="pt-2 pr-4 text-text-heading">
                    {t('economy.totalIncVat')}
                  </td>
                  <td className="pt-2 pr-4 text-right text-text-heading">
                    {fmt(vatBuckets.reduce((s, b) => s + b.exVat, 0))}
                  </td>
                  <td className="pt-2 pr-4 text-right text-text-heading">
                    {fmt(vatBuckets.reduce((s, b) => s + b.vatAmount, 0))}
                  </td>
                  <td className="pt-2 text-right text-text-heading">
                    {fmt(vatBuckets.reduce((s, b) => s + b.incVat, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Export buttons */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ExportButton
          label={t('reports.exportTicketSales')}
          disabled={filteredSales.length === 0}
          onClick={() =>
            exportAccountingTicketsCsv(
              filteredSales.filter((s) => s.category !== 'fb'),
              `regnskap-billettsalg-${slug}.csv`,
            )
          }
        />
        <ExportButton
          label={t('reports.exportFnb')}
          disabled={fnb.length === 0}
          onClick={() =>
            exportAccountingTicketsCsv(
              fnb,
              `regnskap-mat-drikke-${slug}.csv`,
            )
          }
        />
        <ExportButton
          label={t('reports.exportVatSummary')}
          disabled={filteredSales.length === 0 && filteredIncome.length === 0}
          onClick={() =>
            exportAccountingVatCsv(
              filteredSales,
              filteredIncome,
              filteredExpenses,
              `regnskap-mva-oversikt-${slug}.csv`,
            )
          }
        />
        <ExportButton
          label={t('reports.exportAll')}
          disabled={
            filteredSales.length === 0 &&
            filteredIncome.length === 0 &&
            filteredExpenses.length === 0
          }
          onClick={() =>
            exportAccountingSummaryCsv(
              filteredSales,
              filteredIncome,
              filteredExpenses,
              `regnskap-sammendrag-${slug}.csv`,
            )
          }
        />
      </div>

      {/* Economy export */}
      {(filteredIncome.length > 0 || filteredExpenses.length > 0) && (
        <div className="flex">
          <ExportButton
            label={t('economy.exportEconomy')}
            onClick={() =>
              exportEconomyCsv(
                filteredIncome,
                filteredExpenses,
                `regnskap-okonomi-${slug}.csv`,
              )
            }
          />
        </div>
      )}

      {filteredSales.length === 0 &&
        filteredIncome.length === 0 &&
        filteredExpenses.length === 0 && (
          <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
            <FileSpreadsheet size={48} className="mx-auto text-primary" />
            <p className="mt-4 text-lg font-medium text-text-body">
              {t('reports.noSalesData')}
            </p>
          </div>
        )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-text-heading">{value}</p>
      <p className="mt-0.5 text-xs text-text-muted">{sub}</p>
    </div>
  )
}

function ExportButton({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium text-text-body shadow-sm hover:bg-surface-hover disabled:opacity-40 disabled:hover:bg-surface"
    >
      <Download size={16} className="text-primary" />
      {label}
    </button>
  )
}
