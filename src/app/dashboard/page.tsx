'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getTransactions, getExpensesByCategory } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import { formatCurrency } from '@/lib/format'
import type { TransactionFull, CategoryExpense } from '@/types'

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

// "2026-09-30" -> "30 sep"
function shortDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${MESES_CORTO[Number(m) - 1]}`
}

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
  // Todos los movimientos del mes. Ya los traíamos para calcular los totales,
  // asi que el detalle de cada categoría no necesita ninguna consulta extra.
  const [allTx, setAllTx] = useState<TransactionFull[]>([])
  const [showAllCats, setShowAllCats] = useState(false)
  const [openCat, setOpenCat] = useState<string | null>(null)
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
      setAllTx(curTx.data || [])
      // Al cambiar de mes no dejamos abierta la categoría del mes anterior.
      setOpenCat(null)

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
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] tracking-wide text-gray-400 font-medium">RESULTADO DEL MES</p>
            <div className="text-right flex-shrink-0">
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

          {/* text-4xl fijo desbordaba en pantallas de 360px con montos de 7 cifras. */}
          <p className={`text-[26px] sm:text-3xl md:text-4xl font-semibold mt-1 tracking-tight break-words ${net >= 0 ? 'text-emerald-800' : 'text-red-600'}`}
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
          {/* 3 columnas fijas cortaban los números en el celular. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-5 pt-4 border-t border-gray-100 divide-y sm:divide-y-0 divide-gray-100">
            <div className="pt-0">
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
            <div className="pt-3 sm:pt-0 sm:border-l sm:border-gray-100 sm:pl-4">
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
            <div className="pt-3 sm:pt-0 sm:border-l sm:border-gray-100 sm:pl-4">
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
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
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
                const open = openCat === c.category_id
                return (
                  <div key={c.category_id}>
                    {/* En el celular: nombre + monto + variación en una línea y la
                        barra abajo a lo ancho. En escritorio, todo en una sola fila. */}
                    <button
                      type="button"
                      onClick={() => setOpenCat(open ? null : c.category_id)}
                      aria-expanded={open}
                      className={`w-full text-left flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm -mx-2 px-2 py-1 rounded-lg transition-colors ${
                        open ? 'bg-gray-50' : 'hover:bg-gray-50 active:bg-gray-50'
                      }`}
                    >
                      <span className="order-1 flex-1 min-w-0 flex items-center gap-1 md:flex-none md:w-32">
                        <ChevronRight
                          size={13}
                          className={`flex-shrink-0 text-gray-300 transition-transform ${open ? 'rotate-90' : ''}`}
                        />
                        <span className="truncate text-gray-700">{c.category_name}</span>
                      </span>
                      <div className="order-4 w-full h-2 md:order-2 md:w-auto md:flex-1 md:h-4 bg-gray-100 rounded-sm overflow-hidden">
                        <div className="h-full rounded-sm transition-all"
                          style={{
                            width: `${(c.total / maxCat) * 100}%`,
                            background: i === 0 ? '#B54A32' : i < 3 ? '#C08268' : '#D5D2CB'
                          }} />
                      </div>
                      <span className="order-2 md:order-3 text-right text-gray-900 flex-shrink-0 md:w-28"
                            style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                        {formatCurrency(c.total)}
                      </span>
                      <span className={`order-3 md:order-4 w-11 md:w-14 text-right text-xs flex-shrink-0 ${v.color}`}>
                        {v.label}
                      </span>
                    </button>

                    {open && <CategoryDetail categoryId={c.category_id} all={allTx} total={c.total} />}
                  </div>
                )
              })}
              {!showAllCats && restCats.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm pt-2 border-t border-gray-100">
                  <span className="order-1 flex-1 min-w-0 truncate text-gray-400 md:flex-none md:w-32">
                    Otras {restCats.length}
                  </span>
                  <div className="order-4 w-full h-2 md:order-2 md:w-auto md:flex-1 md:h-4 bg-gray-100 rounded-sm overflow-hidden">
                    <div className="h-full bg-gray-300 rounded-sm"
                      style={{ width: `${(restTotal / maxCat) * 100}%` }} />
                  </div>
                  <span className="order-2 md:order-3 text-right text-gray-500 flex-shrink-0 md:w-28"
                        style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                    {formatCurrency(restTotal)}
                  </span>
                  <span className="order-3 md:order-4 w-11 md:w-14 text-right text-xs text-gray-400 flex-shrink-0">
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
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Saldo total</h3>
            <Link href="/cuentas" className="text-xs text-gray-400 hover:text-gray-700">Cuentas</Link>
          </div>
          <p className={`text-2xl sm:text-3xl font-semibold mt-1 tracking-tight break-words ${totalSaldo >= 0 ? 'text-gray-900' : 'text-red-600'}`}
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
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
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
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
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

// Detalle de una categoría: los movimientos que arman ese total.
//
// Filtra en memoria con exactamente el mismo criterio que usa la funcion SQL
// get_expenses_by_category (gastos, no canceladas, category_id de la categoria
// raiz), asi la suma de la lista siempre coincide con el total de la barra.
// Como los movimientos del mes ya estan cargados, abrir esto no consulta nada.
function CategoryDetail({ categoryId, all, total }: {
  categoryId: string
  all: TransactionFull[]
  total: number
}) {
  const txs = all
    .filter(t =>
      t.category_id === categoryId &&
      t.type === 'expense' &&
      t.status !== 'cancelled'
    )
    .sort((a, b) => Number(b.amount) - Number(a.amount))

  const sum = txs.reduce((s, t) => s + Number(t.amount), 0)
  // Si no cuadra con la barra, hay gastos que el detalle no esta viendo.
  // Mejor decirlo que mostrar una lista incompleta en silencio.
  const mismatch = Math.abs(sum - total) > 1

  if (txs.length === 0) {
    return (
      <div className="ml-4 mt-1 mb-2 pl-3 border-l-2 border-gray-100">
        <p className="text-xs text-gray-400 py-2">
          No hay movimientos para mostrar en esta categoría.
        </p>
      </div>
    )
  }

  return (
    <div className="ml-4 mt-1 mb-2 pl-3 border-l-2 border-gray-100 animate-fade-in">
      <div className="flex items-center justify-between text-[11px] text-gray-400 py-1.5">
        <span>{txs.length} {txs.length === 1 ? 'movimiento' : 'movimientos'}</span>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
          {formatCurrency(sum)}
        </span>
      </div>

      <div className="divide-y divide-gray-100">
        {txs.map(t => (
          <div key={t.id} className="flex items-start justify-between gap-3 py-1.5">
            <div className="min-w-0">
              <p className="text-[13px] text-gray-700 truncate">
                {t.description}
                {t.installments_total > 1 && (
                  <span className="text-gray-400">
                    {' '}({t.installment_number}/{t.installments_total})
                  </span>
                )}
              </p>
              <p className="text-[11px] text-gray-400 truncate">
                {shortDate(t.date)}
                {t.subcategory_name && <> · {t.subcategory_name}</>}
                {' · '}{t.account_name}
              </p>
            </div>
            <span className="text-[13px] text-gray-800 flex-shrink-0"
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
              {formatCurrency(Number(t.amount))}
            </span>
          </div>
        ))}
      </div>

      {mismatch && (
        <p className="text-[11px] text-amber-600 py-1.5">
          El detalle suma {formatCurrency(sum)} y la categoría {formatCurrency(total)}.
          Puede haber gastos cargados en una subcategoría.
        </p>
      )}
    </div>
  )
}
