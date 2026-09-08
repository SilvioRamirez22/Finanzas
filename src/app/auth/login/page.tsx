'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Wallet } from 'lucide-react'
import toast from 'react-hot-toast'

// Adonde mandar despues de entrar. Si AppProvider nos rebotó acá desde una
// pantalla concreta, volvemos a esa; si no, al dashboard.
function nextUrl() {
  if (typeof window === 'undefined') return '/dashboard'
  const next = new URLSearchParams(window.location.search).get('next')
  // Solo rutas internas: nada de redirigir a otro dominio.
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/auth')) {
    return next
  }
  return '/dashboard'
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  // Si ya hay sesion valida, no mostramos el formulario: entramos directo.
  // Sin esto, volver atras desde la app te dejaba en el login "logueado".
  useEffect(() => {
    let cancelled = false
    createClient().auth.getSession()
      .then(({ data }) => {
        if (cancelled) return
        if (data.session?.user) {
          window.location.replace(nextUrl())
        } else {
          setChecking(false)
        }
      })
      .catch(() => { if (!cancelled) setChecking(false) })
    return () => { cancelled = true }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (!data.session) throw new Error('No se pudo iniciar la sesion')

      // Antes habia un setTimeout de 400ms "para que se escriba la cookie".
      // En el celular a veces no alcanzaba y el dashboard arrancaba sin
      // sesion -> rebote al login. Ahora confirmamos de verdad que la sesion
      // quedo guardada antes de navegar, reintentando un momento si hace falta.
      const ok = await waitForSession(supabase)
      if (!ok) throw new Error('La sesion no se guardo. Revisá que el navegador acepte cookies.')

      // replace y no assign: el login NO queda en el historial, asi el boton
      // "atras" del celular vuelve a donde estabas y no te tira de nuevo al login.
      window.location.replace(nextUrl())
    } catch (e: any) {
      toast.error(e.message || 'Email o contraseña incorrectos')
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-6 sm:p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center mb-4">
            <Wallet size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Finanzas Personales</h1>
          <p className="text-sm text-gray-500 mt-1">Ingresá a tu cuenta</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm text-gray-700 mb-1.5 block font-medium">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="hola@ejemplo.com"
              required
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base outline-none focus:border-emerald-400 transition-colors"
            />
          </div>
          <div>
            <label className="text-sm text-gray-700 mb-1.5 block font-medium">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              required
              autoComplete="current-password"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base outline-none focus:border-emerald-400 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}

// Espera a que getSession() devuelva la sesion recien creada. En el celular la
// escritura de la cookie puede tardar un instante mas que la respuesta del login.
async function waitForSession(supabase: ReturnType<typeof createClient>) {
  for (let i = 0; i < 12; i++) {
    const { data } = await supabase.auth.getSession()
    if (data.session?.user) return true
    await new Promise(r => setTimeout(r, 150))
  }
  return false
}
