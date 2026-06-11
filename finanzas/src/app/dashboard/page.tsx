'use client'
import { useEffect, useState, useCallback } from 'react'
import { startOfMonth, endOfMonth, format, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'
import {
  getMonthSummary, getExpensesByCategory,
  getMonthlyEvolution
} from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import { formatCurrency, formatPct, calcVariation } from '@/lib/format'
import type { MonthSummary, CategoryExpense, MonthlyEvolution } from '@/types'

const RCOLORS = ['#1D9E75','#378ADD','#D85A30','#534AB7','#BA7517','#E24B4A','#D4537E','#888780']

export default function DashboardPage() {
  const { accounts } = useAppStore()
  const now = new Date()
  const [currentSummary, setCurrentSummary] = useState<MonthSummary | null>(null)
  const [prevSummary, setPrevSummary] = useState<MonthSummary | null>(null)
  const [categories, setCategories] = useState<CategoryExpense[]>([])
  const [evolution, setEvolution] = useState<MonthlyEvolution[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cur, prev, cats, evo] = await Promise.all([
        getMonthSummary(now.getFullYear(), now.getMonth() + 1),
        getMonthSummary(now.getFullYear(), now.getMonth() === 0 ? 12 : now.getMonth(),
          now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()),
        getExpensesByCategory(
          format(startOfMonth(now), 'yyyy-MM-dd'),
          format(endOfMonth(now), 'yyyy-MM-dd')
        ),
        getMonthlyEvolution(12),
      ])
      setCurrentSummary(cur || null)
      setPrevSummary(prev || null)
      setCategories((cats || []).filter(c => c.total > 0))
      setEvolution(evo || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalBalance = accounts
    .filter(a => a.is_active && !a.exclude_from_totals)
    .reduce((s, a) => s + a.current_balance, 0)

  const incomeVar = prevSummary && currentSummary
    ? calcVariation(currentSummary.total_income, prevSummary.total_income) : null
  const expVar = prevSummary && currentSummary
    ? calcVariation(currentSummary.total_expenses, prevSummary.total_expenses) : null

  const monthLabel = format(now, 'MMMM yyyy', { locale: es })

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 capitalize">{monthLabel}</h1>
          <p className="text-sm text-gray-500">Resumen del mes</p>
        </div>
        <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Balance total"
          value={formatCurrency(totalBalance, 'ARS', true)}
          color={totalBalance >= 0 ? 'emerald' : 'red'}
          icon={totalBalance >= 0 ? TrendingUp : TrendingDown}
        />
        <KpiCard
          label="Ingresos del mes"
          value={formatCurrency(currentSummary?.total_income || 0, 'ARS', true)}
          color="blue"
          variation={incomeVar}
          icon={TrendingUp}
        />
        <KpiCard
          label="Gastos del mes"
          value={formatCurrency(currentSummary?.total_expenses || 0, 'ARS', true)}
          color="red"
          variation={expVar !== null ? -expVar : null}
          icon={TrendingDown}
        />
        <KpiCard
          label="Resultado neto"
          value={formatCurrency(currentSummary?.net_balance || 0, 'ARS', true)}
          color={(currentSummary?.net_balance || 0) >= 0 ? 'emerald' : 'red'}
          icon={Minus}
        />
      </div>

      {/* Gráfico evolución + categorías */}
      <div className="grid lg:grid-cols-3 gap-4">

        {/* Evolución mensual */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Evolución últimos 12 meses</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={evolution} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#1D9E75" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E24B4A" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#E24B4A" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="month_label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => formatCurrency(v, 'ARS', true)} />
              <Tooltip
                formatter={(v: number) => formatCurrency(v)}
                labelStyle={{ fontSize: 12 }}
                contentStyle={{ border: '1px solid #f0f0f0', borderRadius: 8, fontSize: 12 }}
              />
              <Area type="monotone" dataKey="total_income" name="Ingresos" stroke="#1D9E75" strokeWidth={2} fill="url(#gIncome)" />
              <Area type="monotone" dataKey="total_expenses" name="Gastos" stroke="#E24B4A" strokeWidth={2} fill="url(#gExpense)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Gastos por categoría — donut */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Gastos por categoría</h2>
          {categories.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={categories} dataKey="total" nameKey="category_name"
                    cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2}>
                    {categories.map((c, i) => (
                      <Cell key={c.category_id} fill={c.category_color || RCOLORS[i % RCOLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ border: '1px solid #f0f0f0', borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2 max-h-32 overflow-y-auto">
                {categories.slice(0, 6).map((c, i) => (
                  <div key={c.category_id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: c.category_color || RCOLORS[i % RCOLORS.length] }} />
                      <span className="text-gray-700 truncate max-w-[100px]">{c.category_name}</span>
                    </div>
                    <span className="text-gray-500 font-medium">{formatCurrency(c.total, 'ARS', true)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-gray-300 text-sm">
              Sin gastos este mes
            </div>
          )}
        </div>
      </div>

      {/* Cuentas */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Cuentas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {accounts.filter(a => a.is_active).map(account => (
            <div key={account.id}
              className="rounded-xl p-3 border border-gray-100"
              style={{ borderLeftColor: account.color, borderLeftWidth: 3 }}>
              <p className="text-xs text-gray-500 truncate">{account.name}</p>
              <p className={`text-sm font-semibold mt-0.5 ${account.current_balance < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                {formatCurrency(account.current_balance, account.currency, true)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Presupuestos */}
      {categories.some(c => c.budget_amount) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Presupuestos del mes</h2>
          <div className="space-y-3">
            {categories.filter(c => c.budget_amount).map(c => {
              const pct = Math.min((c.budget_percentage || 0), 100)
              const over = (c.budget_percentage || 0) > 100
              const warn = (c.budget_percentage || 0) > 80
              return (
                <div key={c.category_id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-700">{c.category_name}</span>
                    <span className={`font-medium ${over ? 'text-red-500' : warn ? 'text-amber-600' : 'text-gray-500'}`}>
                      {formatCurrency(c.total)} / {formatCurrency(c.budget_amount!)}
                      {c.budget_percentage != null && ` (${c.budget_percentage.toFixed(0)}%)`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${over ? 'bg-red-500' : warn ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Componente KPI ----
function KpiCard({ label, value, color, variation, icon: Icon }: {
  label: string; value: string; color: string; variation?: number | null; icon: any
}) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-600 bg-emerald-50',
    red: 'text-red-500 bg-red-50',
    blue: 'text-blue-600 bg-blue-50',
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-gray-500">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={14} />
        </div>
      </div>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
      {variation != null && (
        <p className={`text-xs mt-0.5 ${variation >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {formatPct(variation)} vs mes anterior
        </p>
      )}
    </div>
  )
}

// ---- Helper overloading para getMonthSummary ----
async function getMonthSummaryOverload(year: number, month: number, _y?: number) {
  const { getMonthSummary } = await import('@/lib/api')
  return getMonthSummary(year, month)
}
