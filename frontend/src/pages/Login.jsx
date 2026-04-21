import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmail, signUpWithEmail, signInWithGoogle, supabase } from '../lib/supabase'

const TABS = ['Login', 'Register']

const INITIAL_LOGIN = { email: '', password: '' }
const INITIAL_REGISTER = { firstName: '', lastName: '', email: '', password: '', confirmPassword: '', phone: '' }

function validate(tab, fields) {
  const errors = {}
  if (tab === 'Login') {
    if (!fields.email) errors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(fields.email)) errors.email = 'Enter a valid email'
    if (!fields.password) errors.password = 'Password is required'
  } else {
    if (!fields.firstName.trim()) errors.firstName = 'First name is required'
    if (!fields.lastName.trim()) errors.lastName = 'Last name is required'
    if (!fields.email) errors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(fields.email)) errors.email = 'Enter a valid email'
    if (!fields.password) errors.password = 'Password is required'
    else if (fields.password.length < 8) errors.password = 'Password must be at least 8 characters'
    if (!fields.confirmPassword) errors.confirmPassword = 'Please confirm your password'
    else if (fields.password && fields.confirmPassword !== fields.password) errors.confirmPassword = 'Passwords do not match'
    if (!fields.phone) errors.phone = 'Phone number is required'
    else if (!/^(\+61|0)[2-9]\d{8}$/.test(fields.phone.replace(/\s/g, '')))
      errors.phone = 'Enter a valid Australian number (e.g. 0412 345 678)'
  }
  return errors
}

function normalisePhone(phone) {
  const stripped = phone.replace(/\s/g, '')
  return stripped.startsWith('0') ? '+61' + stripped.slice(1) : stripped
}

export default function Login() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('Login')
  const [login, setLogin] = useState(INITIAL_LOGIN)
  const [register, setRegister] = useState(INITIAL_REGISTER)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')

  function setField(setter) {
    return (e) => {
      const { name, value } = e.target
      setter((prev) => ({ ...prev, [name]: value }))
      setErrors((prev) => ({ ...prev, [name]: undefined }))
      setServerError('')
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    const errs = validate('Login', login)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    const { error } = await signInWithEmail(login.email, login.password)
    setLoading(false)
    if (error) { setServerError(error.message); return }
    navigate('/', { replace: true })
  }

  async function handleRegister(e) {
    e.preventDefault()
    const errs = validate('Register', register)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    const { error } = await signUpWithEmail(
      register.email,
      register.password,
      register.firstName.trim(),
      register.lastName.trim(),
      normalisePhone(register.phone),
    )
    setLoading(false)
    if (error) { setServerError(error.message); return }
    navigate('/', { replace: true })
  }

  async function handleGoogle() {
    setLoading(true)
    await signInWithGoogle()
    // Redirect handled by Supabase OAuth — page will reload
  }

  async function handleForgot(e) {
    e.preventDefault()
    if (!forgotEmail) return
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    setForgotSent(true)
  }

  const inputClass = (field) =>
    `w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
    }`

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8 text-center">
        <span className="text-3xl font-bold text-blue-600 tracking-tight">task.ai</span>
        <p className="text-sm text-gray-500 mt-1">AI-powered home repair assistant</p>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tab switcher */}
        <div className="flex border-b border-gray-100">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setErrors({}); setServerError('') }}
              className={`flex-1 py-4 text-sm font-medium transition ${
                tab === t
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          {serverError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {serverError}
            </div>
          )}

          {/* ── LOGIN TAB ── */}
          {tab === 'Login' && !showForgot && (
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              <div>
                <input
                  name="email"
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  value={login.email}
                  onChange={setField(setLogin)}
                  className={inputClass('email')}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <input
                  name="password"
                  type="password"
                  placeholder="Password"
                  autoComplete="current-password"
                  value={login.password}
                  onChange={setField(setLogin)}
                  className={inputClass('password')}
                />
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition flex items-center justify-center gap-2"
              >
                {loading ? <Spinner /> : 'Sign in'}
              </button>

              <Divider />

              <GoogleButton onClick={handleGoogle} loading={loading} />

              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="w-full text-center text-xs text-blue-600 hover:underline mt-1"
              >
                Forgot password?
              </button>
            </form>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {tab === 'Login' && showForgot && (
            <div className="space-y-4">
              {forgotSent ? (
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  Check your inbox — a reset link has been sent.
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4" noValidate>
                  <p className="text-sm text-gray-600">Enter your email and we'll send a reset link.</p>
                  <input
                    type="email"
                    placeholder="Email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={loading || !forgotEmail}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition flex items-center justify-center gap-2"
                  >
                    {loading ? <Spinner /> : 'Send reset link'}
                  </button>
                </form>
              )}
              <button
                type="button"
                onClick={() => { setShowForgot(false); setForgotSent(false) }}
                className="w-full text-center text-xs text-gray-500 hover:underline"
              >
                ← Back to login
              </button>
            </div>
          )}

          {/* ── REGISTER TAB ── */}
          {tab === 'Register' && (
            <form onSubmit={handleRegister} className="space-y-4" noValidate>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    name="firstName"
                    type="text"
                    placeholder="First name"
                    autoComplete="given-name"
                    value={register.firstName}
                    onChange={setField(setRegister)}
                    className={inputClass('firstName')}
                  />
                  {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <input
                    name="lastName"
                    type="text"
                    placeholder="Last name"
                    autoComplete="family-name"
                    value={register.lastName}
                    onChange={setField(setRegister)}
                    className={inputClass('lastName')}
                  />
                  {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
                </div>
              </div>

              <div>
                <input
                  name="email"
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  value={register.email}
                  onChange={setField(setRegister)}
                  className={inputClass('email')}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>

              <div>
                <input
                  name="password"
                  type="password"
                  placeholder="Password (min 8 characters)"
                  autoComplete="new-password"
                  value={register.password}
                  onChange={setField(setRegister)}
                  className={inputClass('password')}
                />
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>

              <div>
                <input
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  value={register.confirmPassword}
                  onChange={setField(setRegister)}
                  className={inputClass('confirmPassword')}
                />
                {register.confirmPassword && register.confirmPassword !== register.password && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>

              <div>
                <input
                  name="phone"
                  type="tel"
                  placeholder="Phone (e.g. 0412 345 678)"
                  autoComplete="tel"
                  value={register.phone}
                  onChange={setField(setRegister)}
                  className={inputClass('phone')}
                />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>

              <button
                type="submit"
                disabled={loading || (!!register.confirmPassword && register.confirmPassword !== register.password)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition flex items-center justify-center gap-2"
              >
                {loading ? <Spinner /> : 'Create account'}
              </button>

              <Divider />

              <GoogleButton onClick={handleGoogle} loading={loading} />
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function Divider() {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs text-gray-400">or</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}

function GoogleButton({ onClick, loading }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full py-3 border border-gray-200 hover:bg-gray-50 disabled:opacity-60 text-sm font-medium rounded-xl transition flex items-center justify-center gap-2 text-gray-700"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
        <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
      </svg>
      Continue with Google
    </button>
  )
}

function Spinner() {
  return <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
}
