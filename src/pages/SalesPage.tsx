import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, TrendingUp, Ticket, ShoppingBag } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useAuthContext } from '@/contexts/AuthContext'
import { useTicketSales } from '@/hooks/useTicketSales'
import {
  groupByDate,
  groupByType,
  groupByChannel,
  computeForecast,
  splitByCategory,
  totalStats,
} from '@/lib/sales-utils'
import { exportSalesCsv } from '@/lib/export-csv'

const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7', '#ec4899', '#06b6d4', '#f97316']

function StatCard({ label, value, sub, icon: Icon }: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
}) {
  return (
    <div className="rounded-xl bg-slate-900 p-5">
      <div className="flex items-center gap-3 text-slate-400">
        <Icon size={18} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
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

export default function SalesPage() {
  const { t } = useTranslation()
  const { festival } = useAuthContext()
  const { sales, loading } = useTicketSales()
  const currency = festival?.currency ?? 'NOK'

  const { tickets, fnb } = useMemo(() => splitByCategory(sales), [sales])
  const stats = useMemo(() => totalStats(tickets), [tickets])
  const fnbStats = useMemo(() => totalStats(fnb), [fnb])
  const dailySales = useMemo(() => groupByDate(tickets), [tickets])
  const byType = useMemo(() => groupByType(tickets), [tickets])
  const byChannel = useMemo(() => groupByChannel(tickets), [tickets])
  const forecast = useMemo(
    () => computeForecast(dailySales, festival?.start_date ?? null),
    [dailySales, festival?.start_date],
  )
  const fnbByType = useMemo(() => groupByType(fnb), [fnb])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header + export */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('sales.title')}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => exportSalesCsv(tickets, `billettsalg-${new Date().toISOString().slice(0, 10)}.csv`)}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:border-slate-600"
          >
            <Download size={16} />
            {t('sales.exportTickets')}
          </button>
          {fnb.length > 0 && (
            <button
              onClick={() => exportSalesCsv(fnb, `mat-drikke-${new Date().toISOString().slice(0, 10)}.csv`)}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:border-slate-600"
            >
              <Download size={16} />
              {t('sales.exportFnb')}
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Ticket}
          label={t('sales.ticketsSold')}
          value={stats.totalTickets.toLocaleString('nb-NO')}
          sub={`${stats.todayTickets} ${t('sales.today')}`}
        />
        <StatCard
          icon={TrendingUp}
          label={t('sales.ticketRevenue')}
          value={formatCurrency(stats.totalRevenue, currency)}
        />
        {fnb.length > 0 && (
          <StatCard
            icon={ShoppingBag}
            label={t('sales.fnb')}
            value={formatCurrency(fnbStats.totalRevenue, currency)}
            sub={`${fnbStats.totalTickets} ${t('sales.items')}`}
          />
        )}
        {forecast && (
          <StatCard
            icon={TrendingUp}
            label={t('sales.forecast')}
            value={forecast.projectedTotal.toLocaleString('nb-NO')}
            sub={`${forecast.avgPerDay} ${t('sales.perDay')} · ${forecast.daysUntilFestival} ${t('sales.daysLeft')}`}
          />
        )}
      </div>

      {/* Sales over time */}
      {dailySales.length > 0 && (
        <div className="rounded-xl bg-slate-900 p-5">
          <h2 className="mb-4 text-lg font-semibold">{t('sales.salesOverTime')}</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                fontSize={12}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Line
                type="monotone"
                dataKey="tickets"
                name={t('sales.tickets')}
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By type + by channel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Per ticket type */}
        {byType.length > 0 && (
          <div className="rounded-xl bg-slate-900 p-5">
            <h2 className="mb-4 text-lg font-semibold">{t('sales.byTicketType')}</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byType} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#64748b" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="type"
                  stroke="#64748b"
                  fontSize={12}
                  width={120}
                  tick={{ fill: '#94a3b8' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8 }}
                />
                <Bar dataKey="tickets" name={t('sales.tickets')} fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Per channel */}
        {byChannel.length > 0 && (
          <div className="rounded-xl bg-slate-900 p-5">
            <h2 className="mb-4 text-lg font-semibold">{t('sales.byChannel')}</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={byChannel}
                  dataKey="tickets"
                  nameKey="channel"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ channel, tickets }: { channel: string; tickets: number }) =>
                    `${channel === 'web' ? t('sales.web') : t('sales.pos')}: ${tickets}`
                  }
                >
                  {byChannel.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* F&B section */}
      {fnbByType.length > 0 && (
        <div className="rounded-xl bg-slate-900 p-5">
          <h2 className="mb-4 text-lg font-semibold">{t('sales.fnb')}</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={fnbByType} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" stroke="#64748b" fontSize={12} />
              <YAxis
                type="category"
                dataKey="type"
                stroke="#64748b"
                fontSize={12}
                width={150}
                tick={{ fill: '#94a3b8' }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8 }}
              />
              <Bar dataKey="revenue" name={t('sales.revenue')} fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Empty state */}
      {sales.length === 0 && (
        <div className="rounded-xl bg-slate-900 p-12 text-center">
          <Ticket size={48} className="mx-auto text-slate-600" />
          <p className="mt-4 text-lg font-medium text-slate-400">{t('sales.noData')}</p>
          <p className="mt-1 text-sm text-slate-500">{t('sales.noDataHint')}</p>
        </div>
      )}
    </div>
  )
}
