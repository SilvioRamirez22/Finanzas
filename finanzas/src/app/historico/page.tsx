'use client'
import { useState, useEffect } from 'react'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, CartesianGrid
} from 'recharts'
import { getMonthlyEvolution, getExpensesByCategory } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import { formatCurrency, formatPct, calcVariation } from '@/lib/format'
import type { MonthlyEvolution, CategoryExpense, DateRange } from '@/types'

const RANGES: { value: DateRange; label: string }[] = [
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
  { value: '12m', label: '12 meses' },
  { value: 'all', label: 'Todo' },
]

export default function HistoricoPage() {
  const [range, setRange] = useState<DateRange>('6m')
  const [evolution, setEvolution] = useState<MonthlyEvolution[]>([])
  const [categoryData, setCategoryData] = useState<CategoryExpense[]>([])
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Meses para comparar por categoría
  const monthsForCat = range === '3m' ? 3 : range === '6m' ? 6 : range === 'all' ? 24 : 12

  useEffect(() => {
    async function load() {
      setLoading(true)
      const months = range === '3m' ? 3 : range === '6m' ? 6 : range === 'all' ? 24 : 12
      const now = new Date()
      const start = format(startOfMonth(subMonths(now, months - 1)), 'yyyy-MM-dd')
      const end = format(endOfMonth(now), 'yyyy-MM-dd')

      const [evo, cats] = await Promise.all([
        getMonthlyEvolution(months),
        getExpensesByCategory(start, end),
      ])
      setEvolution(evo)
      setCategoryData(cats.filter(c => c.total > 0))
      setLoading(false)
    }
    load()
  }, [range])

  // Construir datos por categoría mes a mes (simplificado: usando totales del período)
  const topCats = categoryData.slice(0, 5)

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header con selector de rango */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Histórico</h1>
        <div className="flex bg-gray-100 rounded-xl p-1">
          {RANGES.map(r => (
            <button key={r.value} onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                range === r.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Evolución ingresos vs gastos */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-4">Ingresos vs Gastos</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={evolution} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="month_label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => formatCurrency(v, 'ARS', true)} />
            <Tooltip
              formatter={(v: number) => formatCurrency(v)}
              contentStyle={{ border: '1px solid #f0f0f0', borderRadius: 8, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="total_income" name="Ingresos" fill="#1D9E75" radius={[3, 3, 0, 0]} />
            <Bar dataKey="total_expenses" name="Gastos" fill="#E24B4A" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Balance neto mensual */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-4">Resultado neto mensual</h2>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={evolution} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="month_label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => formatCurrency(v, 'ARS', true)} />
            <Tooltip
              formatter={(v: number) => formatCurrency(v)}
              contentStyle={{ border: '1px solid #f0f0f0', borderRadius: 8, fontSize: 12 }}
            />
            <Line type="monotone" dataKey="net_balance" name="Neto" stroke="#534AB7" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla de variación mes a mes */}
      {evolution.length >= 2 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 overflow-x-auto">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Comparativa mes a mes</h2>
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-medium">Mes</th>
                <th className="text-right pb-2 font-medium">Ingresos</th>
                <th className="text-right pb-2 font-medium">Gastos</th>
                <th className="text-right pb-2 font-medium">Neto</th>
                <th className="text-right pb-2 font-medium">Var. gastos</th>
              </tr>
            </thead>
            <tbody>
              {[...evolution].reverse().map((m, i, arr) => {
                const prev = arr[i + 1]
                const expVar = prev ? calcVariation(m.total_expenses, prev.total_expenses) : null
                return (
                  <tr key={`${m.year}-${m.month}`} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 text-gray-700 capitalize">{m.month_label}</td>
                    <td className="py-2.5 text-right text-emerald-600">{formatCurrency(m.total_income, 'ARS', true)}</td>
                    <td className="py-2.5 text-right text-red-500">{formatCurrency(m.total_expenses, 'ARS', true)}</td>
                    <td className={`py-2.5 text-right font-medium ${m.net_balance >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                      {formatCurrency(m.net_balance, 'ARS', true)}
                    </td>
                    <td className={`py-2.5 text-right text-xs ${expVar === null ? 'text-gray-300' : expVar > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {expVar !== null ? formatPct(expVar) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Top categorías del período */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-4">Top gastos por categoría en el período</h2>
        <div className="space-y-3">
          {topCats.map((c, i) => {
            const maxVal = topCats[0]?.total || 1
            const pct = (c.total / maxVal) * 100
            return (
              <div key={c.category_id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.category_color || '#888' }} />
                    <span className="text-gray-700">{c.category_name}</span>
                  </div>
                  <span className="text-gray-500 font-medium">{formatCurrency(c.total, 'ARS', true)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full"
                    style={{ width: `${pct}%`, background: c.category_color || '#888' }} />
                </div>
              </div>
            )
          })}
          {!loading && topCats.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Sin datos en el período</p>
          )}
        </div>
      </div>
    </div>
  )
}
