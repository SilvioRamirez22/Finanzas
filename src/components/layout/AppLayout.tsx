'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { createClient } from '@/lib/supabase/client'
import MonthNav from '@/components/layout/MonthNav'
import {
  LayoutGrid, ArrowLeftRight, Target, Wallet, MoreHorizontal,
  Plus, Search, X, TrendingUp, Tags, History, Settings, LogOut,
} from 'lucide-react'

const mainTabs = [
  { href: '/dashboard', label: 'Resumen', icon: LayoutGrid },
  { href: '/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { href: '/presupuestos', label: 'Presupuesto', icon: Target },
  { href: '/cuentas', label: 'Cuentas', icon: Wallet },
  { href: '/inversiones', label: 'Inversiones', icon: TrendingUp },
]

const moreTabs = [
  { href: '/categorias', label: 'Categorías', icon: Tags },
  { href: '/historico', label: 'Histórico', icon: History },
  { href: '/buscar', label: 'Buscar', icon: Search },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
]

// En el celular entran cuatro destinos cómodos + el botón "Más".
const bottomTabs = mainTabs.slice(0, 4)

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { profile, selectedMonth, setSelectedMonth, setQuickAddOpen } = useAppStore()
  const [sheetOpen, setSheetOpen] = useState(false)

  // Cerrar el menú al navegar
  useEffect(() => { setSheetOpen(false) }, [pathname])

  async function handleLogout() {
    await createClient().auth.signOut()
    window.location.href = '/auth/login'
  }

  const inMore = moreTabs.some(t => pathname.startsWith(t.href))
  const inBottomMore = !bottomTabs.some(t => pathname.startsWith(t.href))

  return (
    <div className="min-h-screen bg-[#F5F4F0]">

      {/* ================= HEADER ESCRITORIO ================= */}
      <div className="hidden lg:block bg-white border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6">
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

          <div className="flex items-center justify-between">
            <nav className="flex gap-5">
              {mainTabs.map(tab => {
                const active = pathname.startsWith(tab.href)
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                      active
                        ? 'border-emerald-700 text-emerald-800 font-medium'
                        : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {tab.label}
                  </Link>
                )
              })}
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
              <MonthNav value={selectedMonth} onChange={setSelectedMonth} />
              <Link href="/buscar"
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Buscar
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ================= HEADER CELULAR ================= */}
      <header
        className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between gap-2 px-4 h-12">
          <h1 className="text-[15px] font-semibold text-gray-900 truncate">Finanzas</h1>
          <div className="flex items-center gap-1">
            <Link
              href="/buscar"
              aria-label="Buscar"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 active:bg-gray-100"
            >
              <Search size={19} />
            </Link>
            <button
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 active:bg-gray-100"
            >
              <LogOut size={19} />
            </button>
          </div>
        </div>
        <div className="px-4 pb-2 flex justify-center">
          <MonthNav value={selectedMonth} onChange={setSelectedMonth} />
        </div>
      </header>

      {/* ================= CONTENIDO ================= */}
      <main className="max-w-[1400px] mx-auto px-4 lg:px-6 py-4 lg:py-5 pb-28 lg:pb-5">
        {children}
      </main>

      {/* ================= BOTÓN DE CARGA RÁPIDA (CELULAR) ================= */}
      <button
        onClick={() => setQuickAddOpen(true)}
        aria-label="Cargar un movimiento"
        className="lg:hidden fixed right-4 z-40 w-14 h-14 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/25 flex items-center justify-center active:bg-emerald-700 transition-colors"
        style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
      >
        <Plus size={26} />
      </button>

      {/* ================= NAVEGACIÓN INFERIOR (CELULAR) ================= */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-5">
          {bottomTabs.map(tab => {
            const active = pathname.startsWith(tab.href)
            const Icon = tab.icon
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 h-14 text-[10px] font-medium transition-colors ${
                  active ? 'text-emerald-700' : 'text-gray-400'
                }`}
              >
                <Icon size={21} strokeWidth={active ? 2.4 : 1.9} />
                <span className="leading-none">{tab.label}</span>
              </Link>
            )
          })}
          <button
            onClick={() => setSheetOpen(true)}
            aria-label="Más secciones"
            className={`flex flex-col items-center justify-center gap-0.5 h-14 text-[10px] font-medium transition-colors ${
              inBottomMore ? 'text-emerald-700' : 'text-gray-400'
            }`}
          >
            <MoreHorizontal size={21} strokeWidth={inBottomMore ? 2.4 : 1.9} />
            <span className="leading-none">Más</span>
          </button>
        </div>
      </nav>

      {/* ================= HOJA "MÁS" (CELULAR) ================= */}
      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end">
          <button
            aria-label="Cerrar"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div
            className="relative w-full bg-white rounded-t-2xl shadow-xl pb-2"
            style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="flex items-center justify-between px-5 pt-1 pb-2">
              <p className="text-sm font-semibold text-gray-900">Más secciones</p>
              <button
                onClick={() => setSheetOpen(false)}
                aria-label="Cerrar"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 active:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            {[...mainTabs.slice(4), ...moreTabs].map(t => {
              const Icon = t.icon
              const active = pathname.startsWith(t.href)
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`flex items-center gap-3 px-5 py-3.5 text-[15px] border-t border-gray-100 active:bg-gray-50 ${
                    active ? 'text-emerald-800 font-medium' : 'text-gray-700'
                  }`}
                >
                  <Icon size={19} className={active ? 'text-emerald-700' : 'text-gray-400'} />
                  {t.label}
                </Link>
              )
            })}

            <div className="px-5 pt-3 pb-1 border-t border-gray-100 mt-1">
              <p className="text-xs text-gray-400 truncate">{profile?.email}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
