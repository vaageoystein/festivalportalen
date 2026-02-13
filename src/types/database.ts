export type UserRole = 'admin' | 'board' | 'crew' | 'sponsor' | 'accountant'

export type SponsorStatus = 'contacted' | 'agreed' | 'signed' | 'delivered' | 'invoiced'

export type SponsorLevel = 'hovedsponsor' | 'gull' | 'sølv' | 'bronse' | 'partner'

export type SaleChannel = 'web' | 'pos'

export type SaleCategory = 'ticket' | 'fb'

export interface Festival {
  id: string
  name: string
  slug: string
  logo_url: string | null
  start_date: string | null
  end_date: string | null
  location: string | null
  capacity: number | null
  website: string | null
  default_locale: string
  currency: string
  created_at: string
}

export interface UserProfile {
  id: string
  festival_id: string
  role: UserRole
  full_name: string | null
  email: string | null
  locale: string | null
  has_password: boolean
  created_at: string
}

export interface TicketSale {
  id: string
  festival_id: string
  ticketco_id: string | null
  ticket_type: string
  category: SaleCategory | null
  quantity: number
  price_ex_vat: number | null
  vat_rate: number | null
  vat_amount: number | null
  price_inc_vat: number | null
  sale_channel: SaleChannel | null
  sold_at: string | null
  synced_at: string
}

export interface Sponsor {
  id: string
  festival_id: string
  name: string
  level: SponsorLevel | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  invoice_address: string | null
  logo_url: string | null
  agreement_amount: number | null
  status: SponsorStatus
  notes: string | null
  created_at: string
}

export interface SponsorDeliverable {
  id: string
  sponsor_id: string
  festival_id: string
  description: string
  delivered: boolean
  delivered_at: string | null
  documentation_url: string | null
}

export interface Income {
  id: string
  festival_id: string
  category: string
  description: string | null
  amount_ex_vat: number | null
  vat_rate: number | null
  vat_amount: number | null
  source: string | null
  is_budget: boolean
  date: string | null
  created_at: string
}

export interface Expense {
  id: string
  festival_id: string
  category: string
  description: string | null
  amount_ex_vat: number | null
  vat_rate: number | null
  vat_amount: number | null
  supplier: string | null
  is_budget: boolean
  date: string | null
  created_at: string
}

export interface FestivalIntegration {
  id: string
  festival_id: string
  ticketco_api_key: string | null
  ticketco_event_id: string | null
  created_at: string
}

export interface TicketCoSyncLog {
  id: string
  festival_id: string
  synced_at: string
  records_synced: number | null
  status: 'success' | 'error'
  error_message: string | null
}

export interface Report {
  id: string
  festival_id: string
  type: 'sponsor_report' | 'annual_report' | 'accounting_report'
  title: string | null
  data: Record<string, unknown> | null
  pdf_url: string | null
  created_by: string | null
  sent_to: string[] | null
  created_at: string
}
