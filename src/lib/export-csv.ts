import type { TicketSale, Income, Expense } from '@/types/database'

function formatNumber(n: number | null): string {
  if (n === null) return ''
  return n.toFixed(2)
}

export function escapeCsv(val: string): string {
  // Prevent CSV injection: prefix formula characters with a single quote
  let safe = val
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = `'${safe}`
  }
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

export function downloadCsv(csv: string, filename: string) {
  const bom = '\uFEFF' // UTF-8 BOM for Excel compatibility
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export function exportSalesCsv(sales: TicketSale[], filename: string) {
  const header = [
    'Dato',
    'Billettype',
    'Kategori',
    'Antall',
    'Pris eks. MVA',
    'MVA-sats',
    'MVA-beløp',
    'Pris inkl. MVA',
    'Salgskanal',
  ]

  const rows = sales.map((s) => [
    s.sold_at?.slice(0, 10) ?? '',
    escapeCsv(s.ticket_type),
    s.category === 'fb' ? 'Mat/drikke' : 'Billett',
    String(s.quantity),
    formatNumber(s.price_ex_vat),
    s.vat_rate !== null ? `${(s.vat_rate * 100).toFixed(0)}%` : '',
    formatNumber(s.vat_amount),
    formatNumber(s.price_inc_vat),
    s.sale_channel ?? '',
  ])

  const csv = [header, ...rows].map((row) => row.join(',')).join('\n')
  downloadCsv(csv, filename)
}

export function exportEconomyCsv(
  income: Income[],
  expenses: Expense[],
  filename: string,
) {
  const header = [
    'Type',
    'Kategori',
    'Skildring',
    'Beløp eks. MVA',
    'MVA-sats',
    'MVA-beløp',
    'Beløp inkl. MVA',
    'Kjelde/Leverandør',
    'Budsjett/Faktisk',
    'Dato',
  ]

  const incomeRows = income.map((i) => {
    const exVat = i.amount_ex_vat ?? 0
    const vatRate = i.vat_rate ?? 0
    const vatAmount = i.vat_amount ?? exVat * vatRate
    return [
      'Inntekt',
      escapeCsv(i.category),
      escapeCsv(i.description ?? ''),
      formatNumber(exVat),
      vatRate ? `${(vatRate * 100).toFixed(0)}%` : '',
      formatNumber(vatAmount),
      formatNumber(exVat + vatAmount),
      escapeCsv(i.source ?? ''),
      i.is_budget ? 'Budsjett' : 'Faktisk',
      i.date ?? '',
    ]
  })

  const expenseRows = expenses.map((e) => {
    const exVat = e.amount_ex_vat ?? 0
    const vatRate = e.vat_rate ?? 0
    const vatAmount = e.vat_amount ?? exVat * vatRate
    return [
      'Kostnad',
      escapeCsv(e.category),
      escapeCsv(e.description ?? ''),
      formatNumber(exVat),
      vatRate ? `${(vatRate * 100).toFixed(0)}%` : '',
      formatNumber(vatAmount),
      formatNumber(exVat + vatAmount),
      escapeCsv(e.supplier ?? ''),
      e.is_budget ? 'Budsjett' : 'Faktisk',
      e.date ?? '',
    ]
  })

  const csv = [header, ...incomeRows, ...expenseRows]
    .map((row) => row.join(','))
    .join('\n')
  downloadCsv(csv, filename)
}

// --- Accounting export helpers ---

export interface VatBucket {
  rate: number
  label: string
  exVat: number
  vatAmount: number
  incVat: number
  count: number
}

export function groupSalesByVat(sales: TicketSale[]): VatBucket[] {
  const map = new Map<number, VatBucket>()
  for (const s of sales) {
    const rate = s.vat_rate ?? 0
    const existing = map.get(rate) ?? {
      rate,
      label: rate ? `${(rate * 100).toFixed(0)}%` : '0%',
      exVat: 0,
      vatAmount: 0,
      incVat: 0,
      count: 0,
    }
    existing.exVat += (s.price_ex_vat ?? 0) * s.quantity
    existing.vatAmount += (s.vat_amount ?? 0) * s.quantity
    existing.incVat += (s.price_inc_vat ?? 0) * s.quantity
    existing.count += s.quantity
    map.set(rate, existing)
  }
  return Array.from(map.values()).sort((a, b) => b.rate - a.rate)
}

/** Accounting export: ticket sales sorted by date, grouped for bookkeeping */
export function exportAccountingTicketsCsv(sales: TicketSale[], filename: string) {
  const header = [
    'Dato',
    'Billettype',
    'Antall',
    'Enh.pris eks. MVA',
    'Sum eks. MVA',
    'MVA-sats',
    'MVA-beløp',
    'Sum inkl. MVA',
    'Salgskanal',
  ]

  const sorted = [...sales].sort(
    (a, b) => (a.sold_at ?? '').localeCompare(b.sold_at ?? ''),
  )

  const rows = sorted.map((s) => {
    const exVat = s.price_ex_vat ?? 0
    const vatAmt = s.vat_amount ?? 0
    const incVat = s.price_inc_vat ?? 0
    return [
      s.sold_at?.slice(0, 10) ?? '',
      escapeCsv(s.ticket_type),
      String(s.quantity),
      formatNumber(exVat),
      formatNumber(exVat * s.quantity),
      s.vat_rate !== null ? `${(s.vat_rate * 100).toFixed(0)}%` : '0%',
      formatNumber(vatAmt * s.quantity),
      formatNumber(incVat * s.quantity),
      s.sale_channel ?? '',
    ]
  })

  // Add totals row
  const totalExVat = sorted.reduce((s, r) => s + (r.price_ex_vat ?? 0) * r.quantity, 0)
  const totalVat = sorted.reduce((s, r) => s + (r.vat_amount ?? 0) * r.quantity, 0)
  const totalIncVat = sorted.reduce((s, r) => s + (r.price_inc_vat ?? 0) * r.quantity, 0)
  const totalQty = sorted.reduce((s, r) => s + r.quantity, 0)
  rows.push([])
  rows.push([
    'TOTALT',
    '',
    String(totalQty),
    '',
    formatNumber(totalExVat),
    '',
    formatNumber(totalVat),
    formatNumber(totalIncVat),
    '',
  ])

  const csv = [header, ...rows].map((row) => row.join(',')).join('\n')
  downloadCsv(csv, filename)
}

/** Accounting export: VAT summary grouped by rate */
export function exportAccountingVatCsv(
  sales: TicketSale[],
  income: Income[],
  expenses: Expense[],
  filename: string,
) {
  const header = ['Kilde', 'MVA-sats', 'Grunnlag eks. MVA', 'MVA-beløp', 'Sum inkl. MVA']

  const rows: string[][] = []

  // Sales by VAT rate
  const salesVat = groupSalesByVat(sales)
  for (const b of salesVat) {
    rows.push([
      'Billettsalg/F&B',
      b.label,
      formatNumber(b.exVat),
      formatNumber(b.vatAmount),
      formatNumber(b.incVat),
    ])
  }

  // Income by VAT rate (actual only)
  const actualIncome = income.filter((i) => !i.is_budget)
  const incVatMap = new Map<number, { exVat: number; vatAmt: number }>()
  for (const i of actualIncome) {
    const rate = i.vat_rate ?? 0
    const existing = incVatMap.get(rate) ?? { exVat: 0, vatAmt: 0 }
    existing.exVat += i.amount_ex_vat ?? 0
    existing.vatAmt += i.vat_amount ?? (i.amount_ex_vat ?? 0) * rate
    incVatMap.set(rate, existing)
  }
  for (const [rate, data] of Array.from(incVatMap.entries()).sort((a, b) => b[0] - a[0])) {
    rows.push([
      'Øvrig inntekt',
      rate ? `${(rate * 100).toFixed(0)}%` : '0%',
      formatNumber(data.exVat),
      formatNumber(data.vatAmt),
      formatNumber(data.exVat + data.vatAmt),
    ])
  }

  // Expenses by VAT rate (actual only)
  const actualExpenses = expenses.filter((e) => !e.is_budget)
  const expVatMap = new Map<number, { exVat: number; vatAmt: number }>()
  for (const e of actualExpenses) {
    const rate = e.vat_rate ?? 0
    const existing = expVatMap.get(rate) ?? { exVat: 0, vatAmt: 0 }
    existing.exVat += e.amount_ex_vat ?? 0
    existing.vatAmt += e.vat_amount ?? (e.amount_ex_vat ?? 0) * rate
    expVatMap.set(rate, existing)
  }
  for (const [rate, data] of Array.from(expVatMap.entries()).sort((a, b) => b[0] - a[0])) {
    rows.push([
      'Kostnad',
      rate ? `${(rate * 100).toFixed(0)}%` : '0%',
      formatNumber(data.exVat),
      formatNumber(data.vatAmt),
      formatNumber(data.exVat + data.vatAmt),
    ])
  }

  const csv = [header, ...rows].map((row) => row.join(',')).join('\n')
  downloadCsv(csv, filename)
}

/** Accounting export: full summary of all income and expenses */
export function exportAccountingSummaryCsv(
  sales: TicketSale[],
  income: Income[],
  expenses: Expense[],
  filename: string,
) {
  const header = ['Kategori', 'Beløp eks. MVA', 'MVA-beløp', 'Beløp inkl. MVA']
  const rows: string[][] = []

  // Ticket sales
  const tickets = sales.filter((s) => s.category !== 'fb')
  const ticketExVat = tickets.reduce((s, r) => s + (r.price_ex_vat ?? 0) * r.quantity, 0)
  const ticketVat = tickets.reduce((s, r) => s + (r.vat_amount ?? 0) * r.quantity, 0)
  rows.push(['Billettsalg', formatNumber(ticketExVat), formatNumber(ticketVat), formatNumber(ticketExVat + ticketVat)])

  // F&B sales
  const fnb = sales.filter((s) => s.category === 'fb')
  const fnbExVat = fnb.reduce((s, r) => s + (r.price_ex_vat ?? 0) * r.quantity, 0)
  const fnbVat = fnb.reduce((s, r) => s + (r.vat_amount ?? 0) * r.quantity, 0)
  rows.push(['Mat/drikke', formatNumber(fnbExVat), formatNumber(fnbVat), formatNumber(fnbExVat + fnbVat)])

  // Other income (actual)
  const actualIncome = income.filter((i) => !i.is_budget)
  const otherIncExVat = actualIncome.reduce((s, i) => s + (i.amount_ex_vat ?? 0), 0)
  const otherIncVat = actualIncome.reduce((s, i) => s + (i.vat_amount ?? (i.amount_ex_vat ?? 0) * (i.vat_rate ?? 0)), 0)
  rows.push(['Øvrig inntekt', formatNumber(otherIncExVat), formatNumber(otherIncVat), formatNumber(otherIncExVat + otherIncVat)])

  rows.push([])
  const totalIncExVat = ticketExVat + fnbExVat + otherIncExVat
  const totalIncVat = ticketVat + fnbVat + otherIncVat
  rows.push(['SUM INNTEKTER', formatNumber(totalIncExVat), formatNumber(totalIncVat), formatNumber(totalIncExVat + totalIncVat)])
  rows.push([])

  // Expenses (actual)
  const actualExpenses = expenses.filter((e) => !e.is_budget)
  const expExVat = actualExpenses.reduce((s, e) => s + (e.amount_ex_vat ?? 0), 0)
  const expVat = actualExpenses.reduce((s, e) => s + (e.vat_amount ?? (e.amount_ex_vat ?? 0) * (e.vat_rate ?? 0)), 0)
  rows.push(['SUM KOSTNADER', formatNumber(expExVat), formatNumber(expVat), formatNumber(expExVat + expVat)])

  rows.push([])
  rows.push(['RESULTAT', formatNumber(totalIncExVat - expExVat), formatNumber(totalIncVat - expVat), formatNumber((totalIncExVat + totalIncVat) - (expExVat + expVat))])

  const csv = [header, ...rows].map((row) => row.join(',')).join('\n')
  downloadCsv(csv, filename)
}
