import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(t('auth.loginError'))
    }

    setLoading(false)
  }

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    })
    setResetSent(true)
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="rounded-xl border border-border bg-surface p-8 shadow-sm">
          <div className="mb-2 h-1 w-12 rounded-full bg-primary" />
          <div className="text-center">
            <h1 className="text-2xl font-bold">{t('auth.loginTitle')}</h1>
            <p className="mt-2 text-text-muted">{t('app.tagline')}</p>
          </div>

          {forgotMode ? (
            resetSent ? (
              <p className="mt-6 rounded-lg bg-primary-light p-4 text-center text-sm text-text-body">
                {t('auth.resetSent')}
              </p>
            ) : (
              <form onSubmit={handleForgotPassword} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-text-body">
                    {t('auth.email')}
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-body placeholder-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="din@epost.no"
                  />
                </div>

                {error && (
                  <p className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                >
                  {loading ? t('common.loading') : t('auth.sendReset')}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(false)
                    setError('')
                  }}
                  className="w-full text-center text-sm text-primary hover:underline"
                >
                  {t('common.back')}
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text-body">
                  {t('auth.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-body placeholder-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="din@epost.no"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-text-body">
                  {t('auth.password')}
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-body placeholder-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
              >
                {loading ? t('common.loading') : t('auth.login')}
              </button>

              <button
                type="button"
                onClick={() => {
                  setForgotMode(true)
                  setError('')
                }}
                className="w-full text-center text-sm text-primary hover:underline"
              >
                {t('auth.forgotPassword')}
              </button>

              <p className="text-center text-xs text-text-muted">{t('auth.firstTimeHint')}</p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
