import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const TICKETCO_API_BASE = 'https://ticketco.events/api/public/v1'

interface TicketCoEvent {
  id: number
  title: string
}

interface TicketCoOrder {
  id: number
  created_at: string
  order_lines: {
    id: number
    title: string
    quantity: number
    price: number
    vat_amount: number
    vat_rate: number
    category?: string
  }[]
  source?: string // 'web' | 'pos'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Parse request — can be triggered by cron (no body) or manually (with festival_id)
    let festivalId: string | null = null
    if (req.method === 'POST') {
      try {
        const body = await req.json()
        festivalId = body.festival_id ?? null
      } catch {
        // No body — cron trigger, sync all festivals
      }
    }

    // Get festivals with TicketCo API keys configured
    let query = supabaseAdmin
      .from('festival_integrations')
      .select('festival_id, ticketco_api_key, ticketco_event_id')
      .not('ticketco_api_key', 'is', null)

    if (festivalId) {
      query = query.eq('festival_id', festivalId)
    }

    const { data: integrations, error: intError } = await query
    if (intError || !integrations?.length) {
      return new Response(
        JSON.stringify({ message: 'No festivals with TicketCo configured', error: intError?.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = []

    for (const integration of integrations) {
      const { festival_id, ticketco_api_key, ticketco_event_id } = integration

      try {
        // Get last sync time
        const { data: lastSync } = await supabaseAdmin
          .from('ticketco_sync_log')
          .select('synced_at')
          .eq('festival_id', festival_id)
          .eq('status', 'success')
          .order('synced_at', { ascending: false })
          .limit(1)
          .single()

        const sinceDate = lastSync?.synced_at
          ? new Date(lastSync.synced_at).toISOString()
          : new Date('2020-01-01').toISOString()

        // Fetch orders from TicketCo
        const headers = {
          'Authorization': `Token token=${ticketco_api_key}`,
          'Content-Type': 'application/json',
        }

        let page = 1
        let allOrders: TicketCoOrder[] = []
        let hasMore = true

        while (hasMore) {
          const url = `${TICKETCO_API_BASE}/events/${ticketco_event_id}/orders?since=${sinceDate}&page=${page}&per_page=100`
          const resp = await fetch(url, { headers })

          if (!resp.ok) {
            throw new Error(`TicketCo API error: ${resp.status} ${resp.statusText}`)
          }

          const data = await resp.json()
          const orders: TicketCoOrder[] = data.orders ?? data ?? []

          if (orders.length === 0) {
            hasMore = false
          } else {
            allOrders = allOrders.concat(orders)
            page++
          }
        }

        // Transform and upsert sales
        const salesRows = allOrders.flatMap((order) =>
          (order.order_lines ?? []).map((line) => {
            const isFood = (line.category ?? '').toLowerCase().includes('food')
              || (line.category ?? '').toLowerCase().includes('mat')
              || (line.category ?? '').toLowerCase().includes('drikke')
              || (line.category ?? '').toLowerCase().includes('beverage')

            const priceExVat = line.price - line.vat_amount
            return {
              festival_id,
              ticketco_id: `${order.id}-${line.id}`,
              ticket_type: line.title,
              category: isFood ? 'fb' : 'ticket',
              quantity: line.quantity,
              price_ex_vat: priceExVat,
              vat_rate: line.vat_rate / 100, // TicketCo returns 25, we store 0.25
              vat_amount: line.vat_amount,
              price_inc_vat: line.price,
              sale_channel: order.source === 'pos' ? 'pos' : 'web',
              sold_at: order.created_at,
              synced_at: new Date().toISOString(),
            }
          })
        )

        if (salesRows.length > 0) {
          // Upsert in batches of 500
          for (let i = 0; i < salesRows.length; i += 500) {
            const batch = salesRows.slice(i, i + 500)
            await supabaseAdmin
              .from('ticket_sales')
              .upsert(batch, { onConflict: 'ticketco_id' })
          }
        }

        // Log success
        await supabaseAdmin.from('ticketco_sync_log').insert({
          festival_id,
          records_synced: salesRows.length,
          status: 'success',
        })

        results.push({
          festival_id,
          records_synced: salesRows.length,
          status: 'success',
        })
      } catch (err) {
        // Log error
        await supabaseAdmin.from('ticketco_sync_log').insert({
          festival_id,
          records_synced: 0,
          status: 'error',
          error_message: (err as Error).message,
        })

        results.push({
          festival_id,
          status: 'error',
          error: (err as Error).message,
        })
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
