'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { getAccounts, getCategories, getPaymentMethods, getBudgets } from '@/lib/api'
import AppLayout from '@/components/layout/AppLayout'
import QuickAddModal from '@/components/forms/QuickAddModal'
import type { Profile } from '@/types'

export default function AppProvider({ children }: { children: React.ReactNode }) {
  const {
    setProfile, setAccounts, setCategories, setPaymentMethods, setBudgets,
    quickAddOpen, setQuickAddOpen
  } = useAppStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function boot() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      // Si no hay sesión, vamos al login (protección del lado del cliente)
      if (!session?.user) {
        window.location.assign('/auth/login')
        return
      }

      const user = session.user

      // Cargar perfil (si no existe, lo creamos al vuelo)
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (profile) setProfile(profile as Profile)

      // Cargar datos globales en paralelo (con tolerancia a errores)
      try {
        const [accounts, categories, methods, budgets] = await Promise.all([
          getAccounts(),
          getCategories(),
          getPaymentMethods(),
          getBudgets(),
        ])
        setAccounts(accounts)
        setCategories(categories)
        setPaymentMethods(methods)
        setBudgets(budgets)
      } catch (e) {
        // Si falla la carga de datos, igual dejamos entrar a la app vacía
        console.error('Error cargando datos:', e)
      }

      setReady(true)
    }
    boot()
  }, [])

  async function handleTransactionSuccess() {
    const accounts = await getAccounts()
    setAccounts(accounts)
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
