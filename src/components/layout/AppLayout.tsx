'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid, ArrowLeftRight, Target, Wallet, MoreHorizontal,
  Plus, Search, LogOut, Settings, Tags, LineChart, TrendingUp, X,
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { createClient } from '@/lib/supabase/client'
import MonthNav from '@/components/layout/MonthNav'

const mainTabs = [
  { href: '/dashboard', label: 'Resumen', icon: LayoutGrid },
  { href: '/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { href: '/presupuestos', label: 'Presupuesto', icon: Target },
  { href: '/cuentas', label: 'Cuentas', icon: Wallet },
  { href: '/inversiones', label: 'Inversiones', icon: TrendingUp },
]

const moreTabs = [
  { href: '/categorias', label: 'Categorías', icon: Tags },
  { href: '/historico', label: 'Histórico', icon: LineChart },
  { href: '/buscar', label: 'Buscar', icon: Search },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
]

// En el celular la barra de abajo muestra 4 secciones + "Más".
// Inversiones se abre desde el menú "Más" para que los toques entren cómodos.
const bottomTabs = mainTabs.slice(0, 4)

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { profile, selectedMonth, setSelectedMonth, setQuickAddOpen } = useAppStore()
  const [sheetOpen, setSheetOpen] = useState(false)

  // Cerrar el menú al navegar.
  useEffect(() => { setSheetOpen(false) }, [pathname])

  // Bloquear el scroll de fondo mientras el menú está abierto.
  useEffect(() => {
    if (!sheetOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [sheetOpen])

  async function handleLogout() {
    await createClient().auth.signOut()
    window.location.replace('/auth/login')
  }

  const isActive = (href: string) => pathname.startsWith(href)
  const inMore = [...moreTabs, mainTabs[4]].some(t => isActive(t.href))

  return (
    <div className="min-h-[100dvh] bg-[#F5F4F0] overflow-x-hidden">

      {/* ================= HEADER ================= */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6">

          {/* --- Fila 1: título + acciones --- */}
          <div className="flex items-center justify-between gap-2 pt-3 md:pt-4 pb-1">
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="text-sm md:text-base font-semibold text-gray-900 whitespace-nowrap">
                Finanzas Personales
              </h1>
              {/* El email ocupaba media pantalla en el celular. */}
              <span className="hidden lg:block text-xs text-gray-400 truncate">
                {profile?.email}
              </span>
            </div>

            {/* Acciones de escritorio */}
            <div className="hidden md:flex items-center gap-2 flex-shrink-0">
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

            {/* Acciones de celular: mes + buscar */}
            <div className="flex md:hidden items-center gap-1.5 flex-shrink-0">
              <MonthNav value={selectedMonth} onChange={setSelectedMonth} compact />
              <Link
                href="/buscar"
                aria-label="Buscar"
                className="w-9 h-9 flex items-center justify-center text-gray-500 border border-gray-200 rounded-lg active:bg-gray-100"
              >
                <Search size={16} />
              </Link>
            </div>
          </div>

          {/* --- Fila 2: solo escritorio --- */}
          <div className="hidden md:flex items-center justify-between">
            <nav className="flex gap-5">
              {mainTabs.map(tab => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`
                    py-2.5 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap
                    ${isActive(tab.href)
                      ? 'border-emerald-700 text-emerald-800 font-medium'
                      : 'border-transparent text-gray-500 hover:text-gray-800'}
                  `}
                >
                  {tab.label}
                </Link>
              ))}
              {/* Menú "Más" */}
              <div className="relative group">
                <button className={`py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                  moreTabs.some(t => isActive(t.href))
                    ? 'border-emerald-700 text-emerald-800 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
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
      </header>

      {/* ================= CONTENIDO ================= */}
      {/* pb grande en celular: deja lugar a la barra inferior y al botón "+". */}
      <main className="max-w-[1400px] mx-auto px-3 md:px-6 py-4 md:py-5 pb-28 md:pb-5">
        {children}
      </main>

      {/* ============ BOTÓN "+" (solo celular) ============ */}
      <button
        onClick={() => setQuickAddOpen(true)}
        aria-label="Nuevo movimiento"
        className="md:hidden fixed right-4 bottom-[76px] mb-safe z-40 w-14 h-14 rounded-full bg-emerald-700 text-white shadow-lg flex items-center justify-center active:bg-emerald-800 transition-colors"
      >
        <Plus size={26} />
      </button>

      {/* ============ BARRA INFERIOR (solo celular) ============ */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 pb-safe">
        <div className="grid grid-cols-5">
          {bottomTabs.map(tab => {
            const Icon = tab.icon
            const active = isActive(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  active ? 'text-emerald-700' : 'text-gray-400'
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                <span className="leading-none">{tab.label}</span>
              </Link>
            )
          })}
          <button
            onClick={() => setSheetOpen(true)}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              inMore ? 'text-emerald-700' : 'text-gray-400'
            }`}
          >
            <MoreHorizontal size={20} strokeWidth={inMore ? 2.2 : 1.8} />
            <span className="leading-none">Más</span>
          </button>
        </div>
      </nav>

      {/* ============ MENÚ "MÁS" (hoja inferior) ============ */}
      {sheetOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSheetOpen(false)} />
          <div className="relative bg-white w-full rounded-t-2xl shadow-xl animate-fade-in max-h-[85dvh] overflow-y-auto pb-safe">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-gray-100">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm">Más</p>
                <p className="text-xs text-gray-400 truncate">{profile?.email}</p>
              </div>
              <button onClick={() => setSheetOpen(false)} className="text-gray-400 p-1" aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            <div className="py-2">
              {[mainTabs[4], ...moreTabs].map(t => {
                const Icon = t.icon
                const active = isActive(t.href)
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={`flex items-center gap-3 px-5 py-3.5 text-sm ${
                      active ? 'text-emerald-800 font-medium bg-emerald-50/60' : 'text-gray-700 active:bg-gray-50'
                    }`}
                  >
                    <Icon size={18} className={active ? 'text-emerald-700' : 'text-gray-400'} />
                    {t.label}
                  </Link>
                )
              })}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-red-600 active:bg-gray-50 border-t border-gray-100 mt-2"
              >
                <LogOut size={18} className="text-red-400" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
