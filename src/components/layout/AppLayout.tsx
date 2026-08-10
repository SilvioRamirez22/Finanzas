'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import { createClient } from '@/lib/supabase/client'
import MonthNav from '@/components/layout/MonthNav'

const mainTabs = [
  { href: '/dashboard', label: 'Resumen' },
  { href: '/movimientos', label: 'Movimientos' },
  { href: '/presupuestos', label: 'Presupuesto' },
  { href: '/cuentas', label: 'Cuentas' },
  { href: '/inversiones', label: 'Inversiones' },
]

const moreTabs = [
  { href: '/categorias', label: 'Categorías' },
  { href: '/historico', label: 'Histórico' },
  { href: '/buscar', label: 'Buscar' },
  { href: '/configuracion', label: 'Configuración' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { profile, selectedMonth, setSelectedMonth } = useAppStore()

  async function handleLogout() {
    await createClient().auth.signOut()
    window.location.href = '/auth/login'
  }

  const inMore = moreTabs.some(t => pathname.startsWith(t.href))

  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      {/* Header blanco */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6">
          {/* Fila 1: título + acciones */}
          <div className="flex items-center justify-between pt-4 pb-1">
            <div className="flex items-baseline gap-2">
              <h1 className="text-base font-semibold text-gray-900">Finanzas Personales</h1>
              <span className="text-xs text-gray-400">{profile?.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden text-xs">
                <span className="px-3 py-1.5 text-gray-700 font-medium">Personal</span>
                <Link href="/configuracion" className="px-3 py-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors">
                  Config
                </Link>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Salir
              </button>
            </div>
          </div>

          {/* Fila 2: tabs + navegador de mes */}
          <div className="flex items-center justify-between">
            <nav className="flex gap-5">
              {mainTabs.map(tab => {
                const active = pathname.startsWith(tab.href)
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`
                      py-2.5 text-sm border-b-2 -mb-px transition-colors
                      ${active
                        ? 'border-emerald-700 text-emerald-800 font-medium'
                        : 'border-transparent text-gray-500 hover:text-gray-800'}
                    `}
                  >
                    {tab.label}
                  </Link>
                )
              })}
              {/* Menú "Más" */}
              <div className="relative group">
                <button className={`py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                  inMore ? 'border-emerald-700 text-emerald-800 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}>
                  Más
                </button>
                <div className="absolute left-0 top-full mt-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[150px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                  {moreTabs.map(t => (
                    <Link key={t.href} href={t.href}
                      className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900">
                      {t.label}
                    </Link>
                  ))}
                </div>
              </div>
            </nav>

            <div className="flex items-center gap-2 pb-1.5">
              <MonthNav
                value={selectedMonth}
                onChange={setSelectedMonth}
              />
              <Link href="/buscar"
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Buscar
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <main className="max-w-[1400px] mx-auto px-6 py-5">
        {children}
      </main>
    </div>
  )
}
