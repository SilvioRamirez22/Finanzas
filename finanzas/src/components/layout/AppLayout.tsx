'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { formatCurrency } from '@/lib/format'
import {
  LayoutDashboard, ArrowLeftRight, Tag, CreditCard, Target,
  TrendingUp, History, Search, Settings, Menu, X, Plus,
  LogOut, Wallet
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { href: '/categorias', label: 'Categorías', icon: Tag },
  { href: '/cuentas', label: 'Cuentas', icon: Wallet },
  { href: '/presupuestos', label: 'Presupuestos', icon: Target },
  { href: '/inversiones', label: 'Inversiones', icon: TrendingUp },
  { href: '/historico', label: 'Histórico', icon: History },
  { href: '/buscar', label: 'Buscar', icon: Search },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { sidebarOpen, setSidebarOpen, setQuickAddOpen, accounts, totalBalance } = useAppStore()

  // Cerrar sidebar al navegar en mobile
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  const total = totalBalance()

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-100 z-30
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:block
        flex flex-col
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Wallet size={16} className="text-white" />
            </div>
            <span className="font-semibold text-gray-900">Finanzas</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Balance total */}
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs text-gray-500 mb-0.5">Balance total</p>
          <p className={`text-xl font-semibold ${total >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
            {formatCurrency(total, 'ARS', true)}
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5
                  transition-colors
                  ${active
                    ? 'bg-emerald-50 text-emerald-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="px-2 py-3 border-t border-gray-100">
          <button
            onClick={() => {/* logout */}}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 w-full transition-colors"
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-100 flex items-center justify-between px-4 h-14 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500">
            <Menu size={22} />
          </button>
          <span className="font-semibold text-gray-900">Finanzas</span>
          <button
            onClick={() => setQuickAddOpen(true)}
            className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-sm"
          >
            <Plus size={18} />
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* FAB desktop */}
      <button
        onClick={() => setQuickAddOpen(true)}
        className="fixed bottom-6 right-6 hidden lg:flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-5 py-3 shadow-lg text-sm font-medium transition-colors z-10"
      >
        <Plus size={18} />
        Agregar
      </button>
    </div>
  )
}
