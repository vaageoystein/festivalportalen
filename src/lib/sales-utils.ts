import type { TicketSale } from '@/types/database'

export function groupByDate(sales: TicketSale[]) {
  const map = new Map<string, { date: string; tickets: number; revenue: number }>()
  for (const s of sales) {
    if (!s.sold_at) continue
    const date = s.sold_at.slice(0, 10)
    const existing = map.get(date) ?? { date, tickets: 0, revenue: 0 }
    existing.tickets += s.quantity
    existing.revenue += (s.price_inc_vat ?? 0) * s.quantity
    map.set(date, existing)
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export function groupByType(sales: TicketSale[]) {
  const map = new Map<string, { type: string; tickets: number; revenue: number }>()
  for (const s of sales) {
    const type = s.ticket_type
    const existing = map.get(type) ?? { type, tickets: 0, revenue: 0 }
    existing.tickets += s.quantity
    existing.revenue += (s.price_inc_vat ?? 0) * s.quantity
    map.set(type, existing)
  }
  return Array.from(map.values()).sort((a, b) => b.tickets - a.tickets)
}

export function groupByChannel(sales: TicketSale[]) {
  const map = new Map<string, { channel: string; tickets: number; revenue: number }>()
  for (const s of sales) {
    const channel = s.sale_channel ?? 'web'
    const existing = map.get(channel) ?? { channel, tickets: 0, revenue: 0 }
    existing.tickets += s.quantity
    existing.revenue += (s.price_inc_vat ?? 0) * s.quantity
    map.set(channel, existing)
  }
  return Array.from(map.values())
}

export function computeForecast(
  dailySales: { date: string; tickets: number }[],
  festivalStartDate: string | null,
) {
  if (dailySales.length < 2 || !festivalStartDate) return null

  const totalDays = dailySales.length
  const totalTickets = dailySales.reduce((sum, d) => sum + d.tickets, 0)
  const avgPerDay = totalTickets / totalDays

  const today = new Date()
  const festivalDate = new Date(festivalStartDate)
  const daysUntilFestival = Math.max(
    0,
    Math.ceil((festivalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
  )

  return {
    currentTotal: totalTickets,
    avgPerDay: Math.round(avgPerDay),
    projectedTotal: Math.round(totalTickets + avgPerDay * daysUntilFestival),
    daysUntilFestival,
  }
}

export function splitByCategory(sales: TicketSale[]) {
  return {
    tickets: sales.filter((s) => s.category !== 'fb'),
    fnb: sales.filter((s) => s.category === 'fb'),
  }
}

export function totalStats(sales: TicketSale[]) {
  let totalTickets = 0
  let totalRevenue = 0
  let totalVat = 0
  const today = new Date().toISOString().slice(0, 10)
  let todayTickets = 0

  for (const s of sales) {
    totalTickets += s.quantity
    totalRevenue += (s.price_inc_vat ?? 0) * s.quantity
    totalVat += (s.vat_amount ?? 0) * s.quantity
    if (s.sold_at?.startsWith(today)) {
      todayTickets += s.quantity
    }
  }

  return { totalTickets, totalRevenue, totalVat, todayTickets }
}
