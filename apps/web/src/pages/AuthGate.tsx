import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, BookOpenCheck, GraduationCap, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { apiRequest, ApiError, SESSION_STORAGE_KEY, type AuthSession, type AuthUser } from '../services/api'
import StudentDashboard from './StudentDashboard'

type AuthMode = 'login' | 'register'

interface StoredSession {
  accessToken: string
}

function readStoredSession(): StoredSession | null {
  const stored = localStorage.getItem(SESSION_STORAGE_KEY)
  if (!stored) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch {
    parsed = null
  }
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'accessToken' in parsed &&
    typeof parsed.accessToken === 'string'
  ) {
    return { accessToken: parsed.accessToken }
  }
  localStorage.removeItem(SESSION_STORAGE_KEY)
  return null
}

function AuthGate() {
  const [token, setToken] = useState<string | null>(() => readStoredSession()?.accessToken ?? null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    let active = true
    apiRequest<AuthUser>('/auth/me', token)
      .then((currentUser) => {
        if (active) setUser(currentUser)
      })
      .catch((reason: unknown) => {
        if (!active) return
        if (reason instanceof ApiError && reason.status === 401) {
          localStorage.removeItem(SESSION_STORAGE_KEY)
          setToken(null)
        }
        setError(
          reason instanceof ApiError && reason.status === 401
            ? 'Sua sessão expirou. Entre novamente para continuar.'
            : reason instanceof Error
              ? reason.message
              : 'Não foi possível validar sua sessão.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [token])

  async function authenticate(mode: AuthMode, payload: Record<string, string>) {
    const session = await apiRequest<AuthSession>(
      `/auth/${mode === 'register' ? 'register' : 'login'}`,
      undefined,
      { method: 'POST', body: JSON.stringify(payload) },
    )
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ accessToken: session.accessToken }),
    )
    setToken(session.accessToken)
    setUser(session.user)
    setError('')
  }

  function signOut() {
    localStorage.removeItem(SESSION_STORAGE_KEY)
    setToken(null)
    setUser(null)
    setError('')
  }

  function expireSession() {
    localStorage.removeItem(SESSION_STORAGE_KEY)
    setToken(null)
    setUser(null)
    setError('Sua sessão expirou. Entre novamente para continuar.')
  }

  if (loading) {
    return <div className="auth-loading" role="status">Verificando sua sessão...</div>
  }
  if (!user || !token) {
    return <AuthScreen initialError={error} onAuthenticate={authenticate} />
  }
  return <StudentDashboard user={user} token={token} onSignOut={signOut} onSessionExpired={expireSession} />
}

function AuthScreen({
  initialError,
  onAuthenticate,
}: {
  initialError: string
  onAuthenticate: (mode: AuthMode, payload: Record<string, string>) => Promise<void>
}) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [error, setError] = useState(initialError)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onAuthenticate(mode,
        mode === 'register'
          ? { name: name.trim(), email: email.trim(), password, role }
          : { email: email.trim(), password },
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível entrar.')
    } finally {
      setSubmitting(false)
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode)
    setError('')
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span className="brand-mark"><BookOpenCheck size={20} strokeWidth={2.2} /></span>
          <span className="brand-name">caderno<span>.</span></span>
        </div>
        <span className="eyebrow">SEU SEMESTRE, MAIS LEVE</span>
        <h1 id="auth-title">{mode === 'login' ? 'Bom ter você de volta.' : 'Crie seu espaço de estudos.'}</h1>
        <p className="auth-subtitle">
          {mode === 'login'
            ? 'Entre para acompanhar suas turmas e organizar as próximas avaliações.'
            : 'Uma conta para conectar professores, turmas e planos de estudo.'}
        </p>

        <div className="auth-tabs" role="tablist" aria-label="Acesso à conta">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>Entrar</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => changeMode('register')}>Criar conta</button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && (
            <>
              <label className="form-field">
                <span>Nome completo</span>
                <span className="auth-input"><UserRound size={16} /><input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={120} placeholder="Como podemos chamar você?" /></span>
              </label>
              <fieldset className="role-options">
                <legend>Meu perfil</legend>
                <button type="button" className={role === 'student' ? 'selected' : ''} onClick={() => setRole('student')}><GraduationCap size={16} /> Aluno</button>
                <button type="button" className={role === 'teacher' ? 'selected' : ''} onClick={() => setRole('teacher')}><BookOpenCheck size={16} /> Professor</button>
              </fieldset>
            </>
          )}
          <label className="form-field">
            <span>E-mail</span>
            <span className="auth-input"><Mail size={16} /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={255} placeholder="voce@universidade.edu" /></span>
          </label>
          <label className="form-field">
            <span>Senha</span>
            <span className="auth-input"><LockKeyhole size={16} /><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} maxLength={72} placeholder="Mínimo de 8 caracteres" /></span>
          </label>

          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Aguarde...' : mode === 'login' ? 'Entrar no Caderno' : 'Criar minha conta'}
            {!submitting && <ArrowRight size={16} />}
          </button>
        </form>
        <p className="auth-footnote">Seus dados de estudo ficam associados à sua conta.</p>
      </section>
    </main>
  )
}

export default AuthGate
