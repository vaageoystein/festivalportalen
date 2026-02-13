import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Festival, Sponsor, SponsorDeliverable, TicketSale, Income, Expense } from '@/types/database'

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function fmtDate(date: string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('nb-NO')
}

// --- Sponsor Report PDF ---

export function generateSponsorReportPdf(
  festival: Festival,
  sponsors: Sponsor[],
  deliverables: SponsorDeliverable[],
): jsPDF {
  const doc = new jsPDF()
  const currency = festival.currency ?? 'NOK'
  const pageWidth = doc.internal.pageSize.getWidth()

  // Title
  doc.setFontSize(18)
  doc.text(festival.name, pageWidth / 2, 20, { align: 'center' })
  doc.setFontSize(12)
  doc.text('Sponsorrapport', pageWidth / 2, 28, { align: 'center' })
  doc.setFontSize(9)
  doc.text(`Generert: ${new Date().toLocaleDateString('nb-NO')}`, pageWidth / 2, 34, {
    align: 'center',
  })

  let y = 42

  // Summary
  const totalAmount = sponsors.reduce((s, sp) => s + (sp.agreement_amount ?? 0), 0)
  const signed = sponsors.filter((s) => ['signed', 'delivered', 'invoiced'].includes(s.status)).length
  const totalDels = deliverables.length
  const deliveredDels = deliverables.filter((d) => d.delivered).length

  doc.setFontSize(11)
  doc.text('Sammendrag', 14, y)
  y += 6

  autoTable(doc, {
    startY: y,
    head: [['', '']],
    body: [
      ['Antall sponsorer', String(sponsors.length)],
      ['Signert/levert/fakturert', String(signed)],
      ['Samlet avtalebeløp', fmtCurrency(totalAmount, currency)],
      ['Leveranser levert', `${deliveredDels} / ${totalDels}`],
    ],
    showHead: false,
    theme: 'plain',
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
  })

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // Sponsor table
  doc.setFontSize(11)
  doc.text('Sponsorliste', 14, y)
  y += 6

  const sponsorRows = sponsors.map((sp) => {
    const spDels = deliverables.filter((d) => d.sponsor_id === sp.id)
    const spDelivered = spDels.filter((d) => d.delivered).length
    return [
      sp.name,
      sp.level ?? '',
      sp.agreement_amount != null ? fmtCurrency(sp.agreement_amount, currency) : '',
      sp.status,
      spDels.length > 0 ? `${spDelivered}/${spDels.length}` : '',
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [['Sponsor', 'Nivå', 'Avtalebeløp', 'Status', 'Leveranser']],
    body: sponsorRows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
  })

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // Detailed deliverables per sponsor
  for (const sp of sponsors) {
    const spDels = deliverables.filter((d) => d.sponsor_id === sp.id)
    if (spDels.length === 0) continue

    // Check if we need a new page
    if (y > 260) {
      doc.addPage()
      y = 20
    }

    doc.setFontSize(10)
    doc.text(`${sp.name} — Leveranser`, 14, y)
    y += 5

    const delRows = spDels.map((d) => [
      d.description,
      d.delivered ? 'Levert' : 'Ikkje levert',
      d.delivered_at ? fmtDate(d.delivered_at) : '',
    ])

    autoTable(doc, {
      startY: y,
      head: [['Leveranse', 'Status', 'Levert dato']],
      body: delRows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [99, 102, 241] },
    })

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  return doc
}

// --- Annual Report PDF ---

export function generateAnnualReportPdf(
  festival: Festival,
  sales: TicketSale[],
  income: Income[],
  expenses: Expense[],
  sponsors: Sponsor[],
): jsPDF {
  const doc = new jsPDF()
  const currency = festival.currency ?? 'NOK'
  const pageWidth = doc.internal.pageSize.getWidth()

  // Title
  doc.setFontSize(18)
  doc.text(festival.name, pageWidth / 2, 20, { align: 'center' })
  doc.setFontSize(12)
  doc.text('Årsrapport', pageWidth / 2, 28, { align: 'center' })
  if (festival.start_date && festival.end_date) {
    doc.setFontSize(9)
    doc.text(
      `${fmtDate(festival.start_date)} — ${fmtDate(festival.end_date)}`,
      pageWidth / 2,
      34,
      { align: 'center' },
    )
  }
  doc.setFontSize(9)
  doc.text(`Generert: ${new Date().toLocaleDateString('nb-NO')}`, pageWidth / 2, 40, {
    align: 'center',
  })

  let y = 50

  // --- Section 1: Ticket sales summary ---
  const tickets = sales.filter((s) => s.category !== 'fb')
  const fnb = sales.filter((s) => s.category === 'fb')
  const ticketQty = tickets.reduce((s, r) => s + r.quantity, 0)
  const ticketRev = tickets.reduce((s, r) => s + (r.price_inc_vat ?? 0) * r.quantity, 0)
  const fnbQty = fnb.reduce((s, r) => s + r.quantity, 0)
  const fnbRev = fnb.reduce((s, r) => s + (r.price_inc_vat ?? 0) * r.quantity, 0)

  doc.setFontSize(11)
  doc.text('Billettsalg og F&B', 14, y)
  y += 6

  autoTable(doc, {
    startY: y,
    head: [['Kategori', 'Antall', 'Omsetning inkl. MVA']],
    body: [
      ['Billetter', String(ticketQty), fmtCurrency(ticketRev, currency)],
      ['Mat/drikke', String(fnbQty), fmtCurrency(fnbRev, currency)],
      ['Totalt', String(ticketQty + fnbQty), fmtCurrency(ticketRev + fnbRev, currency)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
  })

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // --- Section 2: Sales by ticket type ---
  const typeMap = new Map<string, { qty: number; rev: number }>()
  for (const s of tickets) {
    const existing = typeMap.get(s.ticket_type) ?? { qty: 0, rev: 0 }
    existing.qty += s.quantity
    existing.rev += (s.price_inc_vat ?? 0) * s.quantity
    typeMap.set(s.ticket_type, existing)
  }

  if (typeMap.size > 0) {
    doc.setFontSize(11)
    doc.text('Per billetttype', 14, y)
    y += 6

    const typeRows = Array.from(typeMap.entries())
      .sort((a, b) => b[1].rev - a[1].rev)
      .map(([type, data]) => [type, String(data.qty), fmtCurrency(data.rev, currency)])

    autoTable(doc, {
      startY: y,
      head: [['Billetttype', 'Antall', 'Omsetning']],
      body: typeRows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [99, 102, 241] },
    })

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  // --- Section 3: Economy (actual only) ---
  const actualIncome = income.filter((i) => !i.is_budget)
  const actualExpenses = expenses.filter((e) => !e.is_budget)

  const totalInc = actualIncome.reduce(
    (s, i) => s + (i.amount_ex_vat ?? 0) + (i.vat_amount ?? (i.amount_ex_vat ?? 0) * (i.vat_rate ?? 0)),
    0,
  )
  const totalExp = actualExpenses.reduce(
    (s, e) => s + (e.amount_ex_vat ?? 0) + (e.vat_amount ?? (e.amount_ex_vat ?? 0) * (e.vat_rate ?? 0)),
    0,
  )

  doc.setFontSize(11)
  doc.text('Økonomi', 14, y)
  y += 6

  // Income by category
  const incByCat = new Map<string, number>()
  for (const i of actualIncome) {
    const cat = i.category
    incByCat.set(cat, (incByCat.get(cat) ?? 0) + (i.amount_ex_vat ?? 0) + (i.vat_amount ?? (i.amount_ex_vat ?? 0) * (i.vat_rate ?? 0)))
  }

  const incRows = Array.from(incByCat.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amount]) => [cat, fmtCurrency(amount, currency)])
  incRows.push(['Sum inntekter', fmtCurrency(totalInc, currency)])

  // Expenses by category
  const expByCat = new Map<string, number>()
  for (const e of actualExpenses) {
    const cat = e.category
    expByCat.set(cat, (expByCat.get(cat) ?? 0) + (e.amount_ex_vat ?? 0) + (e.vat_amount ?? (e.amount_ex_vat ?? 0) * (e.vat_rate ?? 0)))
  }

  const expRows = Array.from(expByCat.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amount]) => [cat, fmtCurrency(amount, currency)])
  expRows.push(['Sum kostnader', fmtCurrency(totalExp, currency)])

  const econRows = [
    ...incRows.map((r) => ['Inntekt', ...r]),
    ['', '', ''],
    ...expRows.map((r) => ['Kostnad', ...r]),
    ['', '', ''],
    ['RESULTAT', '', fmtCurrency(totalInc - totalExp, currency)],
  ]

  autoTable(doc, {
    startY: y,
    head: [['Type', 'Kategori', 'Beløp']],
    body: econRows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [16, 185, 129] },
  })

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // --- Section 4: Sponsors ---
  if (sponsors.length > 0) {
    if (y > 230) {
      doc.addPage()
      y = 20
    }

    const totalSponsor = sponsors.reduce((s, sp) => s + (sp.agreement_amount ?? 0), 0)

    doc.setFontSize(11)
    doc.text('Sponsorer', 14, y)
    y += 6

    const sponsorRows = sponsors.map((sp) => [
      sp.name,
      sp.level ?? '',
      sp.agreement_amount != null ? fmtCurrency(sp.agreement_amount, currency) : '',
      sp.status,
    ])
    sponsorRows.push(['Totalt', '', fmtCurrency(totalSponsor, currency), ''])

    autoTable(doc, {
      startY: y,
      head: [['Sponsor', 'Nivå', 'Avtalebeløp', 'Status']],
      body: sponsorRows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [245, 158, 11] },
    })
  }

  return doc
}
