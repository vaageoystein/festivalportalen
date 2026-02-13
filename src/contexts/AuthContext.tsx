import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { UserProfile, Festival } from '@/types/database'

interface AuthContextValue {
  session: Session | null
  profile: UserProfile | null
  festival: Festival | null
  loading: boolean
  isPasswordRecovery: boolean
  setIsPasswordRecovery: (v: boolean) => void
  refreshProfile: () => Promise<void>
  refreshFestival: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [festival, setFestival] = useState<Festival | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()
      setProfile(data)
      return data
    } catch {
      return null
    }
  }

  const fetchFestival = async (festivalId: string) => {
    try {
      const { data } = await supabase
        .from('festivals')
        .select('*')
        .eq('id', festivalId)
        .single()
      setFestival(data)
    } catch {
      // Festival not found — ok during initial setup
    }
  }

  const refreshProfile = async () => {
    if (session?.user.id) {
      const p = await fetchProfile(session.user.id)
      if (p?.festival_id) {
        await fetchFestival(p.festival_id)
      }
    }
  }

  const refreshFestival = async () => {
    if (profile?.festival_id) {
      await fetchFestival(profile.festival_id)
    }
  }

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session)
        if (session?.user.id) {
          fetchProfile(session.user.id)
            .then((p) => {
              if (p?.festival_id) {
                fetchFestival(p.festival_id).finally(() => setLoading(false))
              } else {
                setLoading(false)
              }
            })
            .catch(() => setLoading(false))
        } else {
          setLoading(false)
        }
      })
      .catch(() => {
        setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
      }

      if (session?.user.id) {
        fetchProfile(session.user.id).then((p) => {
          if (p?.festival_id) {
            fetchFestival(p.festival_id)
          }
        })
      } else {
        setProfile(null)
        setFestival(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        festival,
        loading,
        isPasswordRecovery,
        setIsPasswordRecovery,
        refreshProfile,
        refreshFestival,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}
