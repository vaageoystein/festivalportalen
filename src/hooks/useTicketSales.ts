import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/contexts/AuthContext'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import type { TicketSale } from '@/types/database'

export function useTicketSales() {
  const { festival } = useAuthContext()
  const [sales, setSales] = useState<TicketSale[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSales = useCallback(async () => {
    if (!festival) return
    const { data } = await supabase
      .from('ticket_sales')
      .select('*')
      .eq('festival_id', festival.id)
      .order('sold_at', { ascending: true })
    if (data) setSales(data)
    setLoading(false)
  }, [festival?.id])

  useEffect(() => {
    fetchSales()
  }, [fetchSales])

  useRealtimeTable('ticket_sales', festival?.id, fetchSales)

  return { sales, loading, refetch: fetchSales }
}
