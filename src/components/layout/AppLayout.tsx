'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid, ArrowLeftRight, Target, Wallet, MoreHorizontal,
  Plus, Search, LogOut, Settings, Tags, LineChart, TrendingUp, X,
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { createClient } from '@/lib/supabase/client'
import MonthBar, { shiftMonth } from '@/components/layout/MonthBar'

const mainTabs = [
  { href: '/dashboard', label: 'Resumen', icon: LayoutGrid },
  { href: '/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { href: '/presupuestos', label: 'Presupuesto', icon: Target },
  { href: '/seguimiento', label: 'Seguimiento', icon: LineChart },
  { href: '/cuentas', label: 'Cuentas', icon: Wallet },
  { href: '/inversiones', label: 'Inversiones', icon: TrendingUp },
]

const moreTabs = [
  { href: '/categorias', label: 'Categorías', icon: Tags },
  { href: '/buscar', label: 'Buscar', icon: Search },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
]

// En el celular la barra de abajo muestra 4 secciones + "Más". Cuentas e
// Inversiones van en "Más": los saldos por cuenta ya están en el Resumen.
const bottomTabs = mainTabs.slice(0, 4)
const mobileMoreTabs = [...mainTabs.slice(4), ...moreTabs]

// Pantallas que muestran un mes: solo ahí aparece la barra de mes y funciona
// deslizar para cambiarlo.
const MONTH_PAGES = ['/dashboard', '/movimientos', '/presupuestos', '/seguimiento']

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { profile, selectedMonth, setSelectedMonth, setQuickAddOpen } = useAppStore()
  const [sheetOpen, setSheetOpen] = useState(false)

  // Cerrar el menú al navegar.
  useEffect(() => { setSheetOpen(false) }, [pathname])

  const monthPage = MONTH_PAGES.some(p => pathname.startsWith(p))

  // El mes vive en la dirección (?m=2026-09): recargar o compartir el link
  // mantiene el mes. Al entrar se lee; al cambiar se reescribe sin sumar
  // entradas al historial.
  const urlRead = useRef(false)
  useEffect(() => {
    if (urlRead.current) return
    urlRead.current = true
    const m = new URLSearchParams(window.location.search).get('m')
    const match = m?.match(/^(\d{4})-(\d{2})$/)
    if (match) {
      const month = Number(match[2])
      if (month >= 1 && month <= 12) setSelectedMonth({ year: Number(match[1]), month })
    }
  }, [])
  useEffect(() => {
    if (!urlRead.current) return
    const url = new URL(window.location.href)
    if (monthPage) url.searchParams.set('m', `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}`)
    else url.searchParams.delete('m')
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url.href)
  }, [selectedMonth, pathname, monthPage])

  // Deslizar a los costados cambia de mes. No cuenta si el gesto empieza en
  // una hoja abierta o en una fila que scrollea de costado (chips, tablas).
  const touch = useRef<{ x: number; y: number; t: number } | null>(null)
  function onTouchStart(e: React.TouchEvent) {
    const target = e.target as HTMLElement
    if (!monthPage || e.touches.length !== 1 || target.closest('[role="dialog"], .overflow-x-auto, input, textarea, [data-no-swipe]')) {
      touch.current = null
      return
    }
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touch.current
    touch.current = null
    if (!start) return
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    if (Math.abs(dx) > 70 && Math.abs(dy) < 40 && Date.now() - start.t < 600) {
      setSelectedMonth(shiftMonth(selectedMonth, dx < 0 ? 1 : -1))
    }
  }

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
  const inMore = mobileMoreTabs.some(t => isActive(t.href))

  return (
    <div className="min-h-[100dvh] bg-bg overflow-x-hidden">

      {/* ================= HEADER ================= */}
      <header className="bg-surface border-b border-line sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6">

          {/* --- Fila 1: título + acciones --- */}
          <div className="flex items-center justify-between gap-2 pt-3 md:pt-4 pb-1">
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="text-sm md:text-base font-semibold text-ink-900 whitespace-nowrap">
                Finanzas Personales
              </h1>
              {/* El email ocupaba media pantalla en el celular. */}
              <span className="hidden lg:block text-xs text-ink-500 truncate">
                {profile?.email}
              </span>
            </div>

            {/* Acciones de escritorio */}
            <div className="hidden md:flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center bg-surface-2 border border-line rounded-lg overflow-hidden text-xs">
                <span className="px-3 py-1.5 text-ink-700 font-medium">Personal</span>
                <Link href="/configuracion" className="px-3 py-1.5 text-ink-500 hover:text-ink-900 hover:bg-muted transition-colors">
                  Config
                </Link>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs text-ink-500 hover:text-ink-900 border border-line rounded-lg hover:bg-surface-2 transition-colors"
              >
                Salir
              </button>
            </div>

            {/* Acciones de celular: buscar (el mes va en su propia fila, abajo) */}
            <div className="flex md:hidden items-center gap-1.5 flex-shrink-0">
              <Link
                href="/buscar"
                aria-label="Buscar"
                className="w-9 h-9 flex items-center justify-center text-ink-500 border border-line rounded-lg active:bg-muted"
              >
                <Search size={16} />
              </Link>
            </div>
          </div>

          {/* --- Mes: en el celular, fila propia a lo ancho --- */}
          {monthPage && <MonthBar value={selectedMonth} onChange={setSelectedMonth} className="md:hidden -mx-1.5 pb-1" />}

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
                      ? 'border-brand text-pos font-medium'
                      : 'border-transparent text-ink-500 hover:text-ink-900'}
                  `}
                >
                  {tab.label}
                </Link>
              ))}
              {/* Menú "Más" */}
              <div className="relative group">
                <button className={`py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                  moreTabs.some(t => isActive(t.href))
                    ? 'border-brand text-pos font-medium'
                    : 'border-transparent text-ink-500 hover:text-ink-900'
                }`}>
                  Más
                </button>
                <div className="absolute left-0 top-full mt-0 bg-surface border border-line rounded-lg shadow-lg py-1 min-w-[150px] opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all z-20">
                  {moreTabs.map(t => (
                    <Link key={t.href} href={t.href}
                      className="block px-4 py-2 text-sm text-ink-700 hover:bg-surface-2 hover:text-ink-900">
                      {t.label}
                    </Link>
                  ))}
                </div>
              </div>
            </nav>

            <div className="flex items-center gap-2 pb-1">
              {monthPage && <MonthBar value={selectedMonth} onChange={setSelectedMonth} className="w-[320px]" />}
              <Link href="/buscar"
                className="px-3 py-1.5 text-sm text-ink-700 border border-line rounded-lg hover:bg-surface-2 transition-colors">
                Buscar
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ================= CONTENIDO ================= */}
      {/* pb grande en celular: deja lugar a la barra inferior y al botón "+". */}
      <main
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="max-w-[1400px] mx-auto px-3 md:px-6 py-4 md:py-5 pb-28 md:pb-5"
      >
        {children}
      </main>

      {/* ============ BOTÓN "+" (solo celular) ============ */}
      <button
        onClick={() => setQuickAddOpen(true)}
        aria-label="Nuevo movimiento"
        className="md:hidden fixed right-4 bottom-[76px] mb-safe z-40 w-14 h-14 rounded-full bg-brand text-white shadow-lg flex items-center justify-center active:bg-brand-hover transition-colors"
      >
        <Plus size={26} />
      </button>

      {/* ============ BARRA INFERIOR (solo celular) ============ */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-line pb-safe">
        <div className="grid grid-cols-5">
          {bottomTabs.map(tab => {
            const Icon = tab.icon
            const active = isActive(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  active ? 'text-pos' : 'text-ink-500'
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
              inMore ? 'text-pos' : 'text-ink-500'
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
          <div className="relative bg-surface w-full rounded-t-2xl shadow-xl animate-fade-in max-h-[85dvh] overflow-y-auto pb-safe">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-line" />
            </div>

            <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-line">
              <div className="min-w-0">
                <p className="font-semibold text-ink-900 text-sm">Más</p>
                <p className="text-xs text-ink-500 truncate">{profile?.email}</p>
              </div>
              <button onClick={() => setSheetOpen(false)} className="text-ink-500 p-1" aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            <div className="py-2">
              {mobileMoreTabs.map(t => {
                const Icon = t.icon
                const active = isActive(t.href)
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={`flex items-center gap-3 px-5 py-3.5 text-sm ${
                      active ? 'text-pos font-medium bg-brand-soft' : 'text-ink-700 active:bg-surface-2'
                    }`}
                  >
                    <Icon size={18} className={active ? 'text-pos' : 'text-ink-500'} />
                    {t.label}
                  </Link>
                )
              })}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-neg active:bg-surface-2 border-t border-line mt-2"
              >
                <LogOut size={18} className="text-neg" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
