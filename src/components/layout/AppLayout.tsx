'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Plus, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Tabs principales al estilo de la referencia
const tabs = [
  { href: '/dashboard', label: 'Resumen' },
  { href: '/movimientos', label: 'Movimientos' },
  { href: '/historico', label: 'Mes vs Mes' },
  { href: '/presupuestos', label: 'Presupuesto' },
  { href: '/categorias', label: 'Categorías' },
  { href: '/cuentas', label: 'Cuentas' },
  { href: '/inversiones', label: 'Inversiones' },
  { href: '/buscar', label: 'Buscar' },
  { href: '/configuracion', label: 'Config' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { setQuickAddOpen, profile } = useAppStore()

  async function handleLogout() {
    await createClient().auth.signOut()
    window.location.href = '/auth/login'
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-4 lg:px-6 pt-6 pb-2">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Finanzas Personales</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {profile?.email ? `${profile.email} · Personal` : 'Personal'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-gray-600 flex items-center gap-1.5 text-sm"
          >
            <LogOut size={15} /> Salir
          </button>
        </div>

        {/* Tabs */}
        <nav className="mt-4 border-b border-gray-200 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {tabs.map(tab => {
              const active = pathname.startsWith(tab.href)
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`
                    px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors
                    ${active
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-gray-500 hover:text-gray-800'}
                  `}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>
        </nav>
      </header>

      {/* Contenido */}
      <main className="max-w-6xl mx-auto px-4 lg:px-6 py-4">
        {children}
      </main>

      {/* Botón flotante para agregar */}
      <button
        onClick={() => setQuickAddOpen(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-5 py-3 shadow-lg text-sm font-medium transition-colors z-10"
      >
        <Plus size={18} />
        Agregar
      </button>
    </div>
  )
}
