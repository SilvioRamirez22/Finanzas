'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip
} from 'recharts'
import { RefreshCw } from 'lucide-react'
import {
  getExpensesByCategory, getTransactions
} from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import { formatCurrency } from '@/lib/format'
import PeriodSelector, { Period, periodToDateRange } from '@/components/layout/PeriodSelector'
import type { CategoryExpense } from '@/types'

const RCOLORS = ['#1D9E75','#378ADD','#D85A30','#534AB7','#BA7517','#E24B4A','#D4537E','#888780','#5DCAA5','#85B7EB']
const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function DashboardPage() {
  const { accounts } = useAppStore()
  const now = new Date()

  const [period, setPeriod] = useState<Period>({
    range: 'month',
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  })

  const [income, setIncome] = useState(0)
  const [expenses, setExpenses] = useState(0)
  const [categories, setCategories] = useState<CategoryExpense[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { from, to } = periodToDateRange(period)

      // Gastos por categoría del período
      const cats = await getExpensesByCategory(from, to)
      setCategories((cats || []).filter(c => c.total > 0))

      // Sumar ingresos y gastos del período desde las transacciones
      const { data: txs } = await getTransactions(
        { date_from: from, date_to: to },
        10000, 0
      )
      let inc = 0, exp = 0
      for (const t of (txs || [])) {
        if (t.type === 'income') inc += Number(t.amount)
        else if (t.type === 'expense') exp += Number(t.amount)
      }
      setIncome(inc)
      setExpenses(exp)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { load() }, [load])

  const totalBalance = accounts
    .filter(a => a.is_active && !a.exclude_from_totals)
    .reduce((s, a) => s + a.current_balance, 0)

  const net = income - expenses

  // Etiqueta del período seleccionado
  let periodLabel = ''
  if (period.range === 'all') periodLabel = 'Todo el historial'
  else if (period.range === 'year') periodLabel = `Año ${period.year}`
  else if (period.range === 'month') periodLabel = `${MESES_FULL[period.month - 1]} ${period.year}`
  else {
    const n = period.range === 'last3' ? 3 : period.range === 'last6' ? 6 : 12
    periodLabel = `Últimos ${n} meses (hasta ${MESES_FULL[period.month - 1]} ${period.year})`
  }

  const totalCatGasto = categories.reduce((s, c) => s + c.total, 0)

  return (
    <div className="space-y-5">
      {/* Selector de período */}
      <PeriodSelector period={period} onChange={setPeriod} />

      {/* Header del período */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{periodLabel}</h2>
          <p className="text-sm text-gray-400">Resumen del período</p>
        </div>
        <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* KPI cards estilo KJ Finance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="BALANCE TOTAL"
          value={formatCurrency(totalBalance, 'ARS', true)}
          sub="saldo de todas las cuentas"
          valueColor={totalBalance >= 0 ? 'text-gray-900' : 'text-red-500'}
        />
        <KpiCard
          label="INGRESOS"
          value={formatCurrency(income, 'ARS', true)}
          sub="sueldos, reintegros"
          valueColor="text-emerald-600"
        />
        <KpiCard
          label="GASTOS"
          value={formatCurrency(expenses, 'ARS', true)}
          sub="excluye transferencias"
          valueColor="text-red-500"
        />
        <KpiCard
          label="NETO"
          value={`${net >= 0 ? '+' : ''}${formatCurrency(net, 'ARS', true)}`}
          sub="ingresos − gastos"
          valueColor={net >= 0 ? 'text-emerald-600' : 'text-red-500'}
        />
      </div>

      {/* Gastos por categoría (donut + lista) estilo referencia */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Gastos por categoría</h3>
        {categories.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-4 items-center">
            {/* Donut */}
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={categories} dataKey="total" nameKey="category_name"
                  cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={2}>
                  {categories.map((c, i) => (
                    <Cell key={c.category_id} fill={c.category_color || RCOLORS[i % RCOLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ border: '1px solid #f0f0f0', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>

            {/* Lista de montos al lado */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {categories.map((c, i) => (
                <div key={c.category_id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ background: c.category_color || RCOLORS[i % RCOLORS.length] }} />
                    <span className="text-gray-700 truncate">{c.category_name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-gray-900 font-medium">{formatCurrency(c.total, 'ARS', true)}</span>
                    <span className="text-gray-400 text-xs w-9 text-right">
                      {totalCatGasto > 0 ? `${Math.round((c.total / totalCatGasto) * 100)}%` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-gray-300 text-sm">
            Sin gastos en este período
          </div>
        )}
      </div>

      {/* Cuentas */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Cuentas</h3>
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
    </div>
  )
}

function KpiCard({ label, value, sub, valueColor }: {
  label: string; value: string; sub: string; valueColor: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-xs text-gray-400 font-medium tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${valueColor}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}
