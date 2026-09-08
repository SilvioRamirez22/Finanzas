'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import type { SupabaseClient } from '@supabase/supabase-js'

// Espera a que la sesión sea legible desde el almacenamiento del navegador,
// que es exactamente lo que va a hacer /dashboard apenas carguemos.
// Antes acá había un setTimeout de 400 ms a ciegas: en Safari, con las
// cookies partidas en varios trozos, esa carrera se perdía y el dashboard
// rebotaba de vuelta al login.
async function esperarSesion(supabase: SupabaseClient, timeoutMs = 8000) {
  const hasta = Date.now() + timeoutMs
  while (Date.now() < hasta) {
    const { data } = await supabase.auth.getSession()
    if (data.session) return
    await new Promise(r => setTimeout(r, 100))
  }
  throw new Error('La sesión no se pudo guardar en este navegador. Probá de nuevo.')
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [verificando, setVerificando] = useState(true)
  const supabase = createClient()

  // Si ya hay sesión, no tiene sentido mostrar el formulario: entrar acá
  // logueado y volver a mandar credenciales era justamente lo que dejaba
  // la app dando vueltas entre el login y el dashboard.
  useEffect(() => {
    let cancelado = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelado) return
      if (data.session) window.location.replace('/dashboard')
      else setVerificando(false)
    })
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      await esperarSesion(supabase)
      window.location.assign('/dashboard')
    } catch (e: any) {
      toast.error(e.message || 'Email o contraseña incorrectos')
      setLoading(false)
    }
  }

  if (verificando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
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
              inputMode="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="hola@ejemplo.com"
              required
              autoComplete="email"
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
