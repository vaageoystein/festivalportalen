import { useState, useEffect, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { UserPlus, Shield, ShieldOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/contexts/AuthContext'
import type { UserProfile, UserRole } from '@/types/database'

const ROLES: { value: UserRole; labelKey: string }[] = [
  { value: 'admin', labelKey: 'settings.roleAdmin' },
  { value: 'board', labelKey: 'settings.roleBoard' },
  { value: 'crew', labelKey: 'settings.roleCrew' },
  { value: 'sponsor', labelKey: 'settings.roleSponsor' },
  { value: 'accountant', labelKey: 'settings.roleAccountant' },
]

export default function UserManagement() {
  const { t } = useTranslation()
  const { festival, profile } = useAuthContext()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('crew')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; message: string } | null>(null)

  const fetchUsers = async () => {
    if (!festival) return
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('festival_id', festival.id)
      .order('created_at', { ascending: true })
    if (data) setUsers(data)
  }

  useEffect(() => {
    fetchUsers()
  }, [festival?.id])

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault()
    if (!festival) return
    setInviting(true)
    setInviteResult(null)

    const { error } = await supabase.functions.invoke('invite-user', {
      body: {
        email: inviteEmail,
        role: inviteRole,
        festival_id: festival.id,
      },
    })

    if (error) {
      setInviteResult({ ok: false, message: error.message })
    } else {
      setInviteResult({ ok: true, message: t('settings.inviteSent') })
      setInviteEmail('')
      await fetchUsers()
    }
    setInviting(false)
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    await supabase
      .from('user_profiles')
      .update({ role: newRole })
      .eq('id', userId)
    await fetchUsers()
  }

  const handleToggleActive = async (user: UserProfile) => {
    // Deactivate by changing role — could also use a separate 'active' field
    // For now, we use the Edge Function to disable the auth user
    await supabase.functions.invoke('toggle-user', {
      body: { user_id: user.id },
    })
    await fetchUsers()
  }

  if (!festival || profile?.role !== 'admin') return null

  return (
    <div className="space-y-8">
      {/* Invite form */}
      <div>
        <h3 className="text-lg font-semibold">{t('settings.inviteUser')}</h3>
        <form onSubmit={handleInvite} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="block text-sm font-medium text-text-body">
              {t('auth.email')}
            </label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="bruker@epost.no"
              className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-body placeholder-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-body">
              {t('settings.role')}
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
              className="mt-1 block rounded-lg border border-border bg-surface px-3 py-2 text-text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {t(r.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            <UserPlus size={16} />
            {inviting ? t('common.loading') : t('settings.sendInvite')}
          </button>
        </form>
        {inviteResult && (
          <p
            className={`mt-2 text-sm ${inviteResult.ok ? 'text-success' : 'text-danger'}`}
          >
            {inviteResult.message}
          </p>
        )}
      </div>

      {/* User list */}
      <div>
        <h3 className="text-lg font-semibold">{t('settings.users')}</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="pb-3 pr-4 font-medium">{t('settings.userName')}</th>
                <th className="pb-3 pr-4 font-medium">{t('auth.email')}</th>
                <th className="pb-3 pr-4 font-medium">{t('settings.role')}</th>
                <th className="pb-3 font-medium">{t('settings.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="py-3 pr-4 text-text-heading">
                    {user.full_name || '—'}
                  </td>
                  <td className="py-3 pr-4 text-text-body">{user.email}</td>
                  <td className="py-3 pr-4">
                    {user.id === profile?.id ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary">
                        <Shield size={12} />
                        {t(ROLES.find((r) => r.value === user.role)?.labelKey ?? '')}
                      </span>
                    ) : (
                      <select
                        value={user.role}
                        onChange={(e) =>
                          handleRoleChange(user.id, e.target.value as UserRole)
                        }
                        className="rounded border border-border bg-surface px-2 py-1 text-xs text-text-body"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {t(r.labelKey)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="py-3">
                    {user.id !== profile?.id && (
                      <button
                        onClick={() => handleToggleActive(user)}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-text-muted hover:bg-surface-hover hover:text-danger"
                        title={t('settings.deactivate')}
                      >
                        <ShieldOff size={14} />
                        {t('settings.deactivate')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-text-muted">
                    {t('settings.noUsers')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
