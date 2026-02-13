import { useMemo, useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Ticket, TrendingUp, Wallet, Handshake, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useAuthContext } from '@/contexts/AuthContext'
import { useTicketSales } from '@/hooks/useTicketSales'
import { splitByCategory, totalStats, groupByDate } from '@/lib/sales-utils'
import { supabase } from '@/lib/supabase'
import type { Income, Expense, Sponsor } from '@/types/database'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  trend?: 'up' | 'down' | null
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-3 text-text-muted">
        <Icon size={18} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-bold text-text-heading">{value}</p>
        {trend === 'up' && <ArrowUpRight size={16} className="text-success" />}
        {trend === 'down' && <ArrowDownRight size={16} className="text-danger" />}
      </div>
      {sub && <p className="mt-1 text-sm text-text-muted">{sub}</p>}
    </div>
  )
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const { festival } = useAuthContext()
  const { sales, loading: salesLoading } = useTicketSales()
  const currency = festival?.currency ?? 'NOK'

  const [income, setIncome] = useState<Income[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  const fetchEconomyData = useCallback(async () => {
    if (!festival) return
    const [incRes, expRes, sponRes] = await Promise.all([
      supabase.from('income').select('*').eq('festival_id', festival.id),
      supabase.from('expenses').select('*').eq('festival_id', festival.id),
      supabase.from('sponsors').select('*').eq('festival_id', festival.id),
    ])
    if (incRes.data) setIncome(incRes.data)
    if (expRes.data) setExpenses(expRes.data)
    if (sponRes.data) setSponsors(sponRes.data)
    setDataLoading(false)
  }, [festival?.id])

  useEffect(() => {
    fetchEconomyData()
  }, [fetchEconomyData])

  useRealtimeTable('income', festival?.id, fetchEconomyData)
  useRealtimeTable('expenses', festival?.id, fetchEconomyData)
  useRealtimeTable('sponsors', festival?.id, fetchEconomyData)

  const { tickets } = useMemo(() => splitByCategory(sales), [sales])
  const ticketStats = useMemo(() => totalStats(tickets), [tickets])
  const dailySales = useMemo(() => groupByDate(tickets), [tickets])

  // Sparkline: last 14 days
  const sparklineData = useMemo(() => {
    const last14 = dailySales.slice(-14)
    return last14
  }, [dailySales])

  // Economy aggregates
  const actualIncome = useMemo(
    () => income.filter((i) => !i.is_budget).reduce((sum, i) => sum + (i.amount_ex_vat ?? 0), 0),
    [income],
  )
  const actualExpenses = useMemo(
    () => expenses.filter((e) => !e.is_budget).reduce((sum, e) => sum + (e.amount_ex_vat ?? 0), 0),
    [expenses],
  )
  const sponsorTotal = useMemo(
    () => sponsors.reduce((sum, s) => sum + (s.agreement_amount ?? 0), 0),
    [sponsors],
  )

  const totalIncome = ticketStats.totalRevenue + actualIncome + sponsorTotal
  const result = totalIncome - actualExpenses
  const resultTrend = result > 0 ? 'up' as const : result < 0 ? 'down' as const : null

  // Budget vs actual chart data
  const budgetVsActual = useMemo(() => {
    const incomeCategories = new Map<string, { category: string; budget: number; actual: number }>()
    const expenseCategories = new Map<string, { category: string; budget: number; actual: number }>()

    for (const i of income) {
      const cat = i.category
      const existing = incomeCategories.get(cat) ?? { category: cat, budget: 0, actual: 0 }
      if (i.is_budget) {
        existing.budget += i.amount_ex_vat ?? 0
      } else {
        existing.actual += i.amount_ex_vat ?? 0
      }
      incomeCategories.set(cat, existing)
    }

    for (const e of expenses) {
      const cat = e.category
      const existing = expenseCategories.get(cat) ?? { category: cat, budget: 0, actual: 0 }
      if (e.is_budget) {
        existing.budget += e.amount_ex_vat ?? 0
      } else {
        existing.actual += e.amount_ex_vat ?? 0
      }
      expenseCategories.set(cat, existing)
    }

    return [
      ...Array.from(incomeCategories.values()),
      ...Array.from(expenseCategories.values()),
    ]
  }, [income, expenses])

  // Recent activity: last ticket sales
  const recentSales = useMemo(
    () =>
      [...sales]
        .sort((a, b) => (b.sold_at ?? '').localeCompare(a.sold_at ?? ''))
        .slice(0, 8),
    [sales],
  )

  const loading = salesLoading || dataLoading

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Ticket}
          label={t('dashboard.ticketsSold')}
          value={ticketStats.totalTickets.toLocaleString('nb-NO')}
          sub={`${ticketStats.todayTickets} ${t('dashboard.today').toLowerCase()}`}
        />
        <StatCard
          icon={TrendingUp}
          label={t('dashboard.totalRevenue')}
          value={formatCurrency(totalIncome, currency)}
        />
        <StatCard
          icon={Handshake}
          label={t('sponsors.title')}
          value={sponsors.length > 0 ? formatCurrency(sponsorTotal, currency) : '—'}
          sub={
            sponsors.length > 0
              ? `${sponsors.length} ${t('sponsors.title').toLowerCase()}`
              : undefined
          }
        />
        <StatCard
          icon={Wallet}
          label={t('economy.result')}
          value={totalIncome > 0 || actualExpenses > 0 ? formatCurrency(result, currency) : '—'}
          trend={totalIncome > 0 || actualExpenses > 0 ? resultTrend : null}
        />
      </div>

      {/* Sparkline: ticket sales last 14 days */}
      {sparklineData.length > 1 && (
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">{t('dashboard.salesTrend')}</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={sparklineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
              <XAxis
                dataKey="date"
                stroke="#A8A29E"
                fontSize={12}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis stroke="#A8A29E" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E7E5E4',
                  borderRadius: 8,
                }}
              />
              <Line
                type="monotone"
                dataKey="tickets"
                name={t('sales.tickets')}
                stroke="#6366F1"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Budget vs actual */}
        {budgetVsActual.length > 0 ? (
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">{t('dashboard.budgetVsActual')}</h2>
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
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-8 shadow-sm">
            <Wallet size={40} className="text-text-muted" />
            <p className="mt-3 text-sm font-medium text-text-body">
              {t('dashboard.budgetVsActual')}
            </p>
            <p className="mt-1 text-xs text-text-muted">{t('dashboard.noEconomyData')}</p>
          </div>
        )}

        {/* Recent activity */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">{t('dashboard.recentActivity')}</h2>
          {recentSales.length > 0 ? (
            <ul className="divide-y divide-border-light">
              {recentSales.map((sale) => (
                <li key={sale.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-text-body">{sale.ticket_type}</p>
                    <p className="text-xs text-text-muted">
                      {sale.quantity} × {formatCurrency(sale.price_inc_vat ?? 0, currency)}
                      {sale.sale_channel && ` · ${sale.sale_channel}`}
                    </p>
                  </div>
                  <span className="text-xs text-text-muted">
                    {sale.sold_at
                      ? new Intl.DateTimeFormat('nb-NO', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(sale.sold_at))
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <Ticket size={40} className="text-text-muted" />
              <p className="mt-3 text-xs text-text-muted">{t('dashboard.noActivity')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
