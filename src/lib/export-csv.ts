import type { TicketSale } from '@/types/database'

function formatNumber(n: number | null): string {
  if (n === null) return ''
  return n.toFixed(2)
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
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
  const bom = '\uFEFF' // UTF-8 BOM for Excel compatibility
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })

  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
