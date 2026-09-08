'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { getAccounts, getCategories, getPaymentMethods, getBudgets } from '@/lib/api'
import AppLayout from '@/components/layout/AppLayout'
import QuickAddModal from '@/components/forms/QuickAddModal'
import type { Profile } from '@/types'

// Marca en sessionStorage para cortar el ping-pong login <-> dashboard.
// Si ya rebotamos una vez en esta pestania, la segunda no redirige: mostramos
// un cartel y dejamos que la persona decida, en vez de recargar sin fin.
const BOUNCE_KEY = 'finanzas:auth-bounce'

export default function AppProvider({ children }: { children: React.ReactNode }) {
  const {
    setProfile, setAccounts, setCategories, setPaymentMethods, setBudgets,
    quickAddOpen, setQuickAddOpen
  } = useAppStore()
  const [ready, setReady] = useState(false)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      const supabase = createClient()

      // Antes esto era un getSession() unico: si devolvia null (cosa que en el
      // celular pasa mientras la libreria todavia esta leyendo la cookie), se
      // iba derecho al login. Ahora reintentamos un rato antes de rendirnos.
      const session = await resolveSession(supabase)
      if (cancelled) return

      if (!session?.user) {
        redirectToLogin()
        return
      }

      // Entramos bien: limpiamos la marca de rebote.
      try { sessionStorage.removeItem(BOUNCE_KEY) } catch {}

      const user = session.user

      // Cargar perfil (si no existe, lo creamos al vuelo)
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (cancelled) return
      if (profile) setProfile(profile as Profile)

      // Cargar datos globales en paralelo (con tolerancia a errores)
      try {
        const [accounts, categories, methods, budgets] = await Promise.all([
          getAccounts(),
          getCategories(),
          getPaymentMethods(),
          getBudgets(),
        ])
        if (cancelled) return
        setAccounts(accounts)
        setCategories(categories)
        setPaymentMethods(methods)
        setBudgets(budgets)
      } catch (e) {
        // Si falla la carga de datos, igual dejamos entrar a la app vacia
        console.error('Error cargando datos:', e)
      }

      if (!cancelled) setReady(true)
    }

    function redirectToLogin() {
      let bounced = false
      try { bounced = sessionStorage.getItem(BOUNCE_KEY) === '1' } catch {}

      if (bounced) {
        // Ya rebotamos una vez y seguimos sin sesion: cortamos el loop.
        try { sessionStorage.removeItem(BOUNCE_KEY) } catch {}
        setStuck(true)
        return
      }

      try { sessionStorage.setItem(BOUNCE_KEY, '1') } catch {}
      const next = encodeURIComponent(window.location.pathname + window.location.search)
      // replace y no assign: no dejamos la pantalla protegida en el historial,
      // asi el boton "atras" no vuelve a disparar el mismo rebote.
      window.location.replace(`/auth/login?next=${next}`)
    }

    boot()
    return () => { cancelled = true }
  }, [])

  async function handleTransactionSuccess() {
    const accounts = await getAccounts()
    setAccounts(accounts)
  }

  if (stuck) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6">
        <div className="text-center max-w-xs">
          <p className="text-sm text-gray-700 font-medium">No pudimos abrir tu sesión</p>
          <p className="text-sm text-gray-500 mt-2">
            El navegador no está guardando la sesión. Suele pasar en modo
            incógnito o con las cookies bloqueadas para este sitio.
          </p>
          <a
            href="/auth/login"
            className="inline-block mt-5 bg-emerald-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium"
          >
            Ir al login
          </a>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <AppLayout>
      {children}
      <QuickAddModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onSuccess={handleTransactionSuccess}
      />
    </AppLayout>
  )
}

// Devuelve la sesion, dandole tiempo a la libreria a leer/refrescar la cookie.
// Escuchamos onAuthStateChange en paralelo porque INITIAL_SESSION puede llegar
// despues del primer getSession() cuando el token hay que refrescarlo.
async function resolveSession(supabase: ReturnType<typeof createClient>) {
  const first = await supabase.auth.getSession()
  if (first.data.session?.user) return first.data.session

  return new Promise<typeof first.data.session>(resolve => {
    let done = false
    const finish = (s: typeof first.data.session) => {
      if (done) return
      done = true
      sub.data.subscription.unsubscribe()
      clearInterval(poll)
      clearTimeout(timeout)
      resolve(s)
    }

    const sub = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) finish(session)
    })

    const poll = setInterval(async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user) finish(data.session)
    }, 200)

    // Techo de 2.5s: mas que suficiente y no deja la pantalla colgada.
    const timeout = setTimeout(() => finish(null), 2500)
  })
}
