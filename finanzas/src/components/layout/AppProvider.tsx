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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Cargar perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (profile) setProfile(profile as Profile)

      // Cargar datos globales en paralelo
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
      setReady(true)
    }
    boot()
  }, [])

  async function handleTransactionSuccess() {
    // Recargar cuentas para actualizar balances
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
