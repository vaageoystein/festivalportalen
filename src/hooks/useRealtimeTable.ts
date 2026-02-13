import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function useRealtimeTable(
  table: string,
  festivalId: string | undefined,
  onUpdate: () => void,
) {
  useEffect(() => {
    if (!festivalId) return

    const channel = supabase
      .channel(`${table}-${festivalId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `festival_id=eq.${festivalId}`,
        },
        () => {
          onUpdate()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, festivalId, onUpdate])
}
