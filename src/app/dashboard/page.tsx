'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getTransactions, getExpensesByCategory } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import { formatCurrency } from '@/lib/format'
import type { TransactionFull, CategoryExpense } from '@/types'

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function monthRange(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const last = new Date(year, month, 0).getDate()
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` }
}
function prevMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

export default function DashboardPage() {
  const { accounts, budgets, selectedMonth } = useAppStore()
  const { year, month } = selectedMonth

  const [income, setIncome] = useState(0)
  const [expenses, setExpenses] = useState(0)
  const [txCount, setTxCount] = useState(0)
  const [prevIncome, setPrevIncome] = useState(0)
  const [prevExpenses, setPrevExpenses] = useState(0)
  const [cats, setCats] = useState<CategoryExpense[]>([])
  const [prevCats, setPrevCats] = useState<CategoryExpense[]>([])
  const [recent, setRecent] = useState<TransactionFull[]>([])
  const [showAllCats, setShowAllCats] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const cur = monthRange(year, month)
      const pm = prevMonth(year, month)
      const prev = monthRange(pm.year, pm.month)

      const [curTx, prevTx, curCats, prevCatsData] = await Promise.all([
        getTransactions({ date_from: cur.from, date_to: cur.to }, 5000, 0),
        getTransactions({ date_from: prev.from, date_to: prev.to }, 5000, 0),
        getExpensesByCategory(cur.from, cur.to),
        getExpensesByCategory(prev.from, prev.to),
      ])

      let inc = 0, exp = 0
      for (const t of (curTx.data || [])) {
        if (t.type === 'income') inc += Number(t.amount)
        else if (t.type === 'expense') exp += Number(t.amount)
      }
      setIncome(inc); setExpenses(exp)
      setTxCount((curTx.data || []).length)
      setRecent((curTx.data || []).slice(0, 5))

      let pInc = 0, pExp = 0
      for (const t of (prevTx.data || [])) {
        if (t.type === 'income') pInc += Number(t.amount)
        else if (t.type === 'expense') pExp += Number(t.amount)
      }
      setPrevIncome(pInc); setPrevExpenses(pExp)

      setCats((curCats || []).filter(c => c.total > 0))
      setPrevCats(prevCatsData || [])
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])

  const net = income - expenses
  const prevNet = prevIncome - prevExpenses
  const netDiff = net - prevNet
  const savingsPct = income > 0 ? (net / income) * 100 : 0
  const expPctOfIncome = income > 0 ? Math.min((expenses / income) * 100, 100) : (expenses > 0 ? 100 : 0)

  // Gasto diario promedio y proyección
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth
  const dailyAvg = daysElapsed > 0 ? expenses / daysElapsed : 0
  const projection = dailyAvg * daysInMonth

  const expVarPct = prevExpenses > 0 ? ((expenses - prevExpenses) / prevExpenses) * 100 : null
  const incVarPct = prevIncome > 0 ? ((income - prevIncome) / prevIncome) * 100 : null

  const prevMonthName = MESES[prevMonth(year, month).month - 1]

  const maxCat = cats.length > 0 ? cats[0].total : 1
  const shownCats = showAllCats ? cats : cats.slice(0, 9)
  const restCats = cats.slice(9)
  const restTotal = restCats.reduce((s, c) => s + c.total, 0)
  const totalCats = cats.reduce((s, c) => s + c.total, 0)

  function catVar(c: CategoryExpense) {
    const p = prevCats.find(pc => pc.category_id === c.category_id)
    if (!p || p.total === 0) return { label: 'nuevo', color: 'text-gray-400' }
    const v = ((c.total - p.total) / p.total) * 100
    if (Math.abs(v) < 1) return { label: '=', color: 'text-gray-400' }
    return {
      label: `${v > 0 ? '▲' : '▼'}${Math.abs(v).toFixed(0)}%`,
      color: v > 0 ? 'text-red-600' : 'text-emerald-700'
    }
  }

  // Presupuestos con gasto actual
  const budgetRows = budgets.map(b => {
    const spent = cats.find(c => c.category_id === b.category_id)?.total || 0
    const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0
    return { ...b, spent, pct }
  }).sort((a, b) => b.pct - a.pct).slice(0, 3)

  const totalSaldo = accounts
    .filter(a => a.is_active && !a.exclude_from_totals)
    .reduce((s, a) => s + a.current_balance, 0)

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-4">
      {/* ===== COLUMNA IZQUIERDA ===== */}
      <div className="space-y-4">

        {/* Resultado del mes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between">
            <p className="text-[11px] tracking-wide text-gray-400 font-medium">RESULTADO DEL MES</p>
            <div className="text-right">
              <span className="text-[11px] text-gray-400">vs. {prevMonthName}</span>
              {prevNet !== 0 && (
                <div className={`mt-1 inline-block px-2 py-0.5 rounded text-xs font-medium ${
                  netDiff >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
                }`}>
                  {netDiff >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(netDiff))}
                </div>
              )}
            </div>
          </div>

          <p className={`text-4xl font-semibold mt-1 tracking-tight ${net >= 0 ? 'text-emerald-800' : 'text-red-600'}`}
             style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
            {net >= 0 ? '+' : '−'}$ {formatCurrency(Math.abs(net)).replace(/^\$\s?/, '')}
          </p>

          <p className="text-sm text-gray-500 mt-1">
            {income > 0
              ? <>Ahorraste el <b className="text-gray-700">{savingsPct.toFixed(1)}%</b> de lo que ingresó · {txCount} movimientos</>
              : <>{txCount} movimientos este mes</>}
          </p>

          {/* Barra gastos vs ingresos */}
          <div className="mt-4 h-2 rounded-full bg-emerald-700 overflow-hidden flex">
            <div className="h-full bg-red-600" style={{ width: `${expPctOfIncome}%` }} />
          </div>

          {/* Sub-métricas */}
          <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-400">Ingresos</p>
              <p className="text-lg font-semibold text-gray-900 mt-0.5"
                 style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                {formatCurrency(income)}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {incVarPct === null ? `sin datos de ${prevMonthName}`
                  : Math.abs(incVarPct) < 1 ? `sin cambios vs. ${prevMonthName}`
                  : `${incVarPct > 0 ? '▲' : '▼'}${Math.abs(incVarPct).toFixed(1)}% vs. ${prevMonthName}`}
              </p>
            </div>
            <div className="border-l border-gray-100 pl-4">
              <p className="text-xs text-gray-400">Gastos</p>
              <p className="text-lg font-semibold text-gray-900 mt-0.5"
                 style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                {formatCurrency(expenses)}
              </p>
              <p className={`text-[11px] mt-0.5 ${
                expVarPct === null ? 'text-gray-400' : expVarPct > 0 ? 'text-red-600' : 'text-emerald-700'
              }`}>
                {expVarPct === null ? `sin datos de ${prevMonthName}`
                  : `${expVarPct > 0 ? '▲' : '▼'}${Math.abs(expVarPct).toFixed(1)}% vs. ${prevMonthName}`}
              </p>
            </div>
            <div className="border-l border-gray-100 pl-4">
              <p className="text-xs text-gray-400">Gasto diario prom.</p>
              <p className="text-lg font-semibold text-gray-900 mt-0.5"
                 style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                {formatCurrency(dailyAvg)}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                proyección: {formatCurrency(projection)}
              </p>
            </div>
          </div>
        </div>

        {/* Gastos por categoría */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Gastos por categoría</h3>
            {cats.length > 9 && (
              <button onClick={() => setShowAllCats(!showAllCats)}
                className="text-xs text-gray-400 hover:text-gray-700">
                {showAllCats ? `${cats.length} de ${cats.length} · ver menos` : `9 de ${cats.length} · ver todas`}
              </button>
            )}
          </div>

          {cats.length === 0 ? (
            <p className="text-sm text-gray-300 py-8 text-center">Sin gastos este mes</p>
          ) : (
            <div className="space-y-2.5">
              {shownCats.map((c, i) => {
                const v = catVar(c)
                return (
                  <div key={c.category_id} className="flex items-center gap-3 text-sm">
                    <span className="w-32 truncate text-gray-700 flex-shrink-0">{c.category_name}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded-sm overflow-hidden">
                      <div className="h-full rounded-sm transition-all"
                        style={{
                          width: `${(c.total / maxCat) * 100}%`,
                          background: i === 0 ? '#B54A32' : i < 3 ? '#C08268' : '#D5D2CB'
                        }} />
                    </div>
                    <span className="w-28 text-right text-gray-900 flex-shrink-0"
                          style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                      {formatCurrency(c.total)}
                    </span>
                    <span className={`w-14 text-right text-xs flex-shrink-0 ${v.color}`}>{v.label}</span>
                  </div>
                )
              })}
              {!showAllCats && restCats.length > 0 && (
                <div className="flex items-center gap-3 text-sm pt-2 border-t border-gray-100">
                  <span className="w-32 truncate text-gray-400 flex-shrink-0">Otras {restCats.length}</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded-sm overflow-hidden">
                    <div className="h-full bg-gray-300 rounded-sm"
                      style={{ width: `${(restTotal / maxCat) * 100}%` }} />
                  </div>
                  <span className="w-28 text-right text-gray-500 flex-shrink-0"
                        style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                    {formatCurrency(restTotal)}
                  </span>
                  <span className="w-14 text-right text-xs text-gray-400 flex-shrink-0">
                    {totalCats > 0 ? `${Math.round((restTotal / totalCats) * 100)}%` : ''}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== COLUMNA DERECHA ===== */}
      <div className="space-y-4">

        {/* Saldo total */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Saldo total</h3>
            <Link href="/cuentas" className="text-xs text-gray-400 hover:text-gray-700">Cuentas</Link>
          </div>
          <p className={`text-3xl font-semibold mt-1 tracking-tight ${totalSaldo >= 0 ? 'text-gray-900' : 'text-red-600'}`}
             style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
            {totalSaldo < 0 ? '−' : ''}$ {formatCurrency(Math.abs(totalSaldo)).replace(/^\$\s?/, '')}
          </p>
          <div className="mt-3 divide-y divide-gray-100">
            {accounts.filter(a => a.is_active).map(a => (
              <div key={a.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-600">{a.name}</span>
                <span className={a.current_balance < 0 ? 'text-red-600' : 'text-gray-900'}
                      style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                  {a.current_balance < 0 ? '−' : ''}{formatCurrency(Math.abs(a.current_balance))}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Presupuesto */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Presupuesto de {MESES[month - 1]}
            </h3>
            <Link href="/presupuestos" className="text-xs text-gray-400 hover:text-gray-700">Ver</Link>
          </div>
          {budgetRows.length === 0 ? (
            <p className="text-sm text-gray-300 py-4 text-center">
              Sin presupuestos definidos
            </p>
          ) : (
            <div className="space-y-3">
              {budgetRows.map(b => {
                const over = b.pct > 100
                const warn = b.pct > 80
                return (
                  <div key={b.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700">{b.category?.name}</span>
                      <span className={over ? 'text-red-600' : warn ? 'text-amber-600' : 'text-emerald-700'}>
                        {b.pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${over ? 'bg-red-600' : warn ? 'bg-amber-500' : 'bg-emerald-700'}`}
                        style={{ width: `${Math.min(b.pct, 100)}%` }} />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1"
                       style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                      {formatCurrency(b.spent)} de {formatCurrency(b.amount)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Últimos movimientos */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">Últimos movimientos</h3>
            <Link href="/movimientos" className="text-xs text-gray-400 hover:text-gray-700">
              Ver {txCount}
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-300 py-4 text-center">Sin movimientos</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {recent.map(t => (
                <div key={t.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{t.description}</p>
                    <p className="text-[11px] text-gray-400">
                      {t.category_name || 'Sin categoría'} · {t.date}
                    </p>
                  </div>
                  <span className={`text-sm flex-shrink-0 ml-3 ${
                    t.type === 'income' ? 'text-emerald-700' : 'text-red-600'
                  }`} style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                    {t.type === 'income' ? '+' : '−'}{formatCurrency(Number(t.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

