'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getTransactions, getExpensesByCategory } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import { formatCurrency } from '@/lib/format'
import RecurringBadge from '@/components/RecurringBadge'
import { CardSkeleton, ErrorState } from '@/components/ui/States'
import { useMonthData } from '@/lib/useMonthData'
import { summarizeMonth, monthProgress } from '@/lib/budget'
import { pendingFixed, isFixed } from '@/lib/fixed'
import LoadFixedSheet from '@/components/forms/LoadFixedSheet'
import AttentionCard, { type AttentionItem } from '@/components/dashboard/AttentionCard'
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

async function loadMonth(year: number, month: number) {
  const cur = monthRange(year, month)
  const pm = prevMonth(year, month)
  const prev = monthRange(pm.year, pm.month)
  const [curTx, prevTx, curCats, prevCats] = await Promise.all([
    getTransactions({ date_from: cur.from, date_to: cur.to }, 5000, 0),
    getTransactions({ date_from: prev.from, date_to: prev.to }, 5000, 0),
    getExpensesByCategory(cur.from, cur.to),
    getExpensesByCategory(prev.from, prev.to),
  ])
  return {
    curTx: curTx.data || [],
    prevTx: prevTx.data || [],
    cats: (curCats || []).filter(c => c.total > 0),
    prevCats: prevCats || [],
  }
}

function sumMonth(txs: TransactionFull[]) {
  let income = 0, expenses = 0
  for (const t of txs) {
    if (t.type === 'income') income += Number(t.amount)
    else if (t.type === 'expense') expenses += Number(t.amount)
  }
  return { income, expenses }
}

export default function DashboardPage() {
  const { accounts, budgets, categories, selectedMonth } = useAppStore()
  const { year, month } = selectedMonth

  const { data, error, reload } = useMonthData(loadMonth)
  const [showAllCats, setShowAllCats] = useState(false)
  const [openCat, setOpenCat] = useState<string | null>(null)
  const [loadingFixed, setLoadingFixed] = useState(false)
  // Al cambiar de mes no dejamos abierta la categoría del mes anterior.
  useEffect(() => { setOpenCat(null) }, [year, month])

  // Todos los movimientos del mes: ya se traen para calcular los totales, así
  // que el detalle de cada categoría no necesita ninguna consulta extra.
  // Los del mes anterior sirven para avisar qué gastos fijos faltan cargar.
  const allTx = data?.curTx ?? []
  const prevAllTx = data?.prevTx ?? []
  const cats = data?.cats ?? []
  const prevCats = data?.prevCats ?? []
  const { income, expenses } = sumMonth(allTx)
  const { income: prevIncome, expenses: prevExpenses } = sumMonth(prevAllTx)
  const txCount = allTx.length
  const recent = allTx.slice(0, 5)

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
    if (!p || p.total === 0) return { label: 'nuevo', color: 'text-ink-500' }
    const v = ((c.total - p.total) / p.total) * 100
    if (Math.abs(v) < 1) return { label: '=', color: 'text-ink-500' }
    return {
      label: `${v > 0 ? '▲' : '▼'}${Math.abs(v).toFixed(0)}%`,
      color: v > 0 ? 'text-neg' : 'text-pos'
    }
  }

  // Plan del mes: el mismo cálculo que la pantalla de Presupuesto, con los
  // movimientos que ya están cargados (este mes y el anterior).
  const rootIds = categories.filter(c => !c.parent_id && c.type !== 'income').map(c => c.id)
  const plan = summarizeMonth([...allTx, ...prevAllTx], budgets, year, month, rootIds)
  const planProgress = monthProgress(year, month)
  const planPct = plan.plannedTotal > 0 ? plan.spentTotal / plan.plannedTotal : 0
  const overCats = plan.lines.filter(l => l.budget > 0 && l.variable > l.budget)
  const planLeft = plan.budgetedVariable - plan.variableOnBudgeted

  // Gastos fijos: los de este mes, y los del mes anterior que todavía no
  // aparecen (misma regla que la hoja de "cargar los fijos", lib/fixed.ts).
  const fixedTx = allTx.filter(t => isFixed(t) && t.type === 'expense')
  const fixedTotal = fixedTx.reduce((s, t) => s + Number(t.amount), 0)
  const fixedPending = pendingFixed(prevAllTx, allTx, year, month)
    .filter(c => c.source.type === 'expense')
    .map(c => c.source)

  const totalSaldo = accounts
    .filter(a => a.is_active && !a.exclude_from_totals)
    .reduce((s, a) => s + a.current_balance, 0)

  // Una cuenta sin saldo inicial y en negativo no está mostrando plata: está
  // mostrando la suma de todo lo cargado desde que empezó a usarse la app.
  // Mientras pase eso, decirle "Saldo total" al número es mentir.
  const saldosSinConfigurar = accounts.some(a =>
    a.is_active && !a.exclude_from_totals &&
    Number(a.initial_balance) === 0 && a.current_balance < 0
  )

  // ---- Atención: lo que pide hacer algo, de lo más grave a lo menos ----
  const catName = (id: string) => categories.find(c => c.id === id)?.name || 'Sin categoría'
  const money = (n: number) => formatCurrency(Math.round(n))
  const attention: AttentionItem[] = []
  if (data) {
    if (overCats.length > 0) {
      const excess = overCats.reduce((s, l) => s + l.variable - l.budget, 0)
      attention.push({
        key: 'over', tone: 'neg', icon: 'over',
        title: overCats.length === 1
          ? `${catName(overCats[0].id)} se pasó del plan (+${money(excess)})`
          : `${overCats.length} categorías se pasaron del plan (+${money(excess)})`,
        detail: overCats.length > 1 ? overCats.map(l => `${catName(l.id)} +${money(l.variable - l.budget)}`).join(' · ') : undefined,
        action: { label: 'Ver', href: '/presupuestos' },
      })
    }
    if (saldosSinConfigurar) {
      attention.push({
        key: 'balance', tone: 'warn', icon: 'balance',
        title: 'Los saldos no tienen punto de partida',
        detail: 'Escribí cuánta plata hay hoy en cada cuenta',
        action: { label: 'Configurar', href: '/cuentas' },
      })
    }
    const fixedMissing = pendingFixed(prevAllTx, allTx, year, month)
    if (fixedMissing.length > 0) {
      attention.push({
        key: 'fixed', tone: 'warn', icon: 'fixed',
        title: `${fixedMissing.length === 1 ? '1 fijo sin cargar' : `${fixedMissing.length} fijos sin cargar`} en ${MESES[month - 1]}`,
        detail: fixedMissing.map(c => c.source.description).join(', '),
        action: { label: 'Cargar', onClick: () => setLoadingFixed(true) },
      })
    }
    // Van más rápido que el mes: con el tope a este ritmo, se pasan antes de fin de mes.
    if (planProgress > 0 && planProgress < 1) {
      const ahead = plan.lines
        .filter(l => l.budget > 0 && l.variable <= l.budget && l.variable / l.budget > planProgress + 0.15)
        .sort((a, b) => b.variable / b.budget - a.variable / a.budget)
      if (ahead.length > 0) {
        const l = ahead[0]
        attention.push({
          key: 'pace', tone: 'warn', icon: 'pace',
          title: ahead.length === 1
            ? `${catName(l.id)} va adelantada`
            : `${ahead.length} categorías van adelantadas`,
          detail: `${catName(l.id)}: ${Math.round((l.variable / l.budget) * 100)} % del tope con el ${Math.round(planProgress * 100)} % del mes`
            + (ahead.length > 1 ? ` · también ${ahead.slice(1, 3).map(a => catName(a.id)).join(', ')}` : ''),
          action: { label: 'Ver', href: '/presupuestos' },
        })
      }
    }
    // Solo gastos: un ingreso sin categoría no desarma ningún reporte (A4).
    const uncategorized = allTx.filter(t => t.type === 'expense' && !t.category_id && t.status !== 'cancelled')
    if (uncategorized.length > 0) {
      attention.push({
        key: 'uncategorized', tone: 'info', icon: 'uncategorized',
        title: `${uncategorized.length === 1 ? '1 gasto' : `${uncategorized.length} gastos`} sin categoría`,
        detail: `${money(uncategorized.reduce((s, t) => s + Number(t.amount), 0))} que no aparecen en los gastos por categoría`,
        action: { label: 'Categorizar', href: '/movimientos?categoria=sin' },
      })
    }
  }

  // Sin datos del mes y con error: no hay nada útil para mostrar.
  if (error && !data) return <ErrorState onRetry={reload} />

  return (
    // minmax(0, 1fr): sin esto, un texto largo que no se corta estira la
    // columna más allá del ancho del celular.
    <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_380px] gap-4">
      {/* Falló una recarga en segundo plano: los números de abajo son los de antes. */}
      {error && data && (
        <div className="lg:col-span-2"><ErrorState compact onRetry={reload} /></div>
      )}

      {/* Atención: arriba de todo y a lo ancho, solo si hay algo que hacer. */}
      {attention.length > 0 && (
        <div className="lg:col-span-2"><AttentionCard items={attention} /></div>
      )}

      {/* ===== COLUMNA IZQUIERDA ===== */}
      <div className="space-y-4">
        {/* Mientras llega el mes nuevo, esqueleto: nunca los números del mes anterior. */}
        {!data ? (
          <>
            <CardSkeleton big lines={3} />
            <CardSkeleton lines={6} />
          </>
        ) : (
          <>
          {/* Resultado del mes */}
          <div className="bg-surface rounded-2xl border border-line p-4 md:p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] tracking-wide text-ink-500 font-medium">RESULTADO DEL MES</p>
              <div className="text-right flex-shrink-0">
                <span className="text-[11px] text-ink-500">vs. {prevMonthName}</span>
                {prevNet !== 0 && (
                  <div className={`mt-1 inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    netDiff >= 0 ? 'bg-brand-soft text-pos' : 'bg-neg-soft text-neg'
                  }`}>
                    {netDiff >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(netDiff))}
                  </div>
                )}
              </div>
            </div>

            {/* text-4xl fijo desbordaba en pantallas de 360px con montos de 7 cifras. */}
            <p className={`text-[26px] sm:text-3xl md:text-4xl font-semibold mt-1 tracking-tight break-words ${net >= 0 ? 'text-pos' : 'text-neg'} num`}>
              {net >= 0 ? '+' : '−'}$ {formatCurrency(Math.abs(net)).replace(/^\$\s?/, '')}
            </p>

            <p className="text-sm text-ink-500 mt-1">
              {income > 0
                ? <>Ahorraste el <b className="text-ink-700">{savingsPct.toFixed(1)}%</b> de lo que ingresó · {txCount} movimientos</>
                : <>{txCount} movimientos este mes</>}
            </p>

            {/* Barra gastos vs ingresos */}
            <div className="mt-4 h-2 rounded-full bg-brand overflow-hidden flex">
              <div className="h-full bg-neg-fill" style={{ width: `${expPctOfIncome}%` }} />
            </div>

            {/* Sub-métricas */}
            {/* 3 columnas fijas cortaban los números en el celular. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-5 pt-4 border-t border-line divide-y sm:divide-y-0 divide-line">
              <div className="pt-0">
                <p className="text-xs text-ink-500">Ingresos</p>
                <p className="text-lg font-semibold text-ink-900 mt-0.5 num">
                  {formatCurrency(income)}
                </p>
                <p className="text-[11px] text-ink-500 mt-0.5">
                  {incVarPct === null ? `sin datos de ${prevMonthName}`
                    : Math.abs(incVarPct) < 1 ? `sin cambios vs. ${prevMonthName}`
                    : `${incVarPct > 0 ? '▲' : '▼'}${Math.abs(incVarPct).toFixed(1)}% vs. ${prevMonthName}`}
                </p>
              </div>
              <div className="pt-3 sm:pt-0 sm:border-l sm:border-line sm:pl-4">
                <p className="text-xs text-ink-500">Gastos</p>
                <p className="text-lg font-semibold text-ink-900 mt-0.5 num">
                  {formatCurrency(expenses)}
                </p>
                <p className={`text-[11px] mt-0.5 ${
                  expVarPct === null ? 'text-ink-500' : expVarPct > 0 ? 'text-neg' : 'text-pos'
                }`}>
                  {expVarPct === null ? `sin datos de ${prevMonthName}`
                    : `${expVarPct > 0 ? '▲' : '▼'}${Math.abs(expVarPct).toFixed(1)}% vs. ${prevMonthName}`}
                </p>
              </div>
              <div className="pt-3 sm:pt-0 sm:border-l sm:border-line sm:pl-4">
                <p className="text-xs text-ink-500">Gasto diario prom.</p>
                <p className="text-lg font-semibold text-ink-900 mt-0.5 num">
                  {formatCurrency(dailyAvg)}
                </p>
                <p className="text-[11px] text-ink-500 mt-0.5">
                  proyección: {formatCurrency(projection)}
                </p>
              </div>
            </div>
          </div>

          {/* Gastos por categoría */}
          <div className="bg-surface rounded-2xl border border-line p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-ink-900">Gastos por categoría</h3>
              {cats.length > 9 && (
                <button onClick={() => setShowAllCats(!showAllCats)}
                  className="text-xs text-ink-500 hover:text-ink-700">
                  {showAllCats ? `${cats.length} de ${cats.length} · ver menos` : `9 de ${cats.length} · ver todas`}
                </button>
              )}
            </div>

            {cats.length === 0 ? (
              <p className="text-sm text-ink-500 py-8 text-center">Sin gastos este mes</p>
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
                          open ? 'bg-surface-2' : 'hover:bg-surface-2 active:bg-surface-2'
                        }`}
                      >
                        <span className="order-1 flex-1 min-w-0 flex items-center gap-1 md:flex-none md:w-32">
                          <ChevronRight
                            size={13}
                            className={`flex-shrink-0 text-ink-500 transition-transform ${open ? 'rotate-90' : ''}`}
                          />
                          <span className="truncate text-ink-700">{c.category_name}</span>
                        </span>
                        <div className="order-4 w-full h-2 md:order-2 md:w-auto md:flex-1 md:h-4 bg-muted rounded-sm overflow-hidden">
                          <div className="h-full rounded-sm transition-all"
                            style={{
                              width: `${(c.total / maxCat) * 100}%`,
                              background: i === 0 ? 'var(--data-1)' : i < 3 ? 'var(--data-2)' : 'var(--data-3)'
                            }} />
                        </div>
                        <span className="order-2 md:order-3 text-right text-ink-900 flex-shrink-0 md:w-28 num">
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
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm pt-2 border-t border-line">
                    <span className="order-1 flex-1 min-w-0 truncate text-ink-500 md:flex-none md:w-32">
                      Otras {restCats.length}
                    </span>
                    <div className="order-4 w-full h-2 md:order-2 md:w-auto md:flex-1 md:h-4 bg-muted rounded-sm overflow-hidden">
                      <div className="h-full bg-line-strong rounded-sm"
                        style={{ width: `${(restTotal / maxCat) * 100}%` }} />
                    </div>
                    <span className="order-2 md:order-3 text-right text-ink-500 flex-shrink-0 md:w-28 num">
                      {formatCurrency(restTotal)}
                    </span>
                    <span className="order-3 md:order-4 w-11 md:w-14 text-right text-xs text-ink-500 flex-shrink-0">
                      {totalCats > 0 ? `${Math.round((restTotal / totalCats) * 100)}%` : ''}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          </>
        )}
      </div>

      {/* ===== COLUMNA DERECHA ===== */}
      <div className="space-y-4">

        {/* Saldo total */}
        <div className="bg-surface rounded-2xl border border-line p-4 md:p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-900">
              {saldosSinConfigurar ? 'Movimiento acumulado' : 'Saldo total'}
            </h3>
            <Link href="/cuentas" className="text-xs text-ink-500 hover:text-ink-700">Cuentas</Link>
          </div>
          <p className={`text-2xl sm:text-3xl font-semibold mt-1 tracking-tight break-words ${totalSaldo >= 0 ? 'text-ink-900' : 'text-neg'} num`}>
            {totalSaldo < 0 ? '−' : ''}$ {formatCurrency(Math.abs(totalSaldo)).replace(/^\$\s?/, '')}
          </p>
          {saldosSinConfigurar && (
            <p className="text-[11px] text-warn mt-1">
              No es la plata que tenés: es la suma de lo cargado, sin saldo de partida.{' '}
              <Link href="/cuentas" className="underline underline-offset-2 font-medium">
                Configurar saldos
              </Link>
            </p>
          )}
          <div className="mt-3 divide-y divide-line">
            {accounts.filter(a => a.is_active).map(a => (
              <div key={a.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink-700">{a.name}</span>
                <span className={`num ${a.current_balance < 0 ? 'text-neg' : 'text-ink-900'}`}>
                  {a.current_balance < 0 ? '−' : ''}{formatCurrency(Math.abs(a.current_balance))}
                </span>
              </div>
            ))}
          </div>
        </div>

        {!data ? (
          <>
            <CardSkeleton lines={3} />
            <CardSkeleton lines={3} />
            <CardSkeleton lines={5} />
          </>
        ) : (
          <>
          {/* Gastos fijos */}
          <div className="bg-surface rounded-2xl border border-line p-4 md:p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">Gastos fijos</h3>
              <button type="button" onClick={() => setLoadingFixed(true)}
                className="h-9 px-3 -my-1.5 -mr-1 rounded-lg border border-line text-xs font-semibold text-brand-ink hover:bg-surface-2">
                Cargar fijos
              </button>
            </div>
            <p className="text-2xl font-semibold mt-1 tracking-tight text-ink-900 break-words num">
              {formatCurrency(fixedTotal)}
            </p>
            <p className="text-[11px] text-ink-500 mt-0.5">
              {fixedTx.length} {fixedTx.length === 1 ? 'gasto fijo' : 'gastos fijos'} en {MESES[month - 1]}
              {expenses > 0 && fixedTotal > 0 && <> · {Math.round((fixedTotal / expenses) * 100)}% del gasto</>}
            </p>

            {/* Cada gasto fijo cargado este mes, del más caro al más barato. */}
            {fixedTx.length > 0 && (
              <div className="mt-3 divide-y divide-line">
                {[...fixedTx].sort((a, b) => Number(b.amount) - Number(a.amount)).map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                    <div className="min-w-0">
                      <p className="text-ink-700 truncate">
                        <span className="text-pos mr-1">✓</span>{t.description}
                      </p>
                      <p className="text-[11px] text-ink-500 truncate">
                        {shortDate(t.date)}{t.category_name && <> · {t.category_name}</>}
                      </p>
                    </div>
                    <span className="text-ink-900 flex-shrink-0 num">
                      {formatCurrency(Number(t.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {fixedPending.length > 0 && (
              <div className="mt-3 pt-3 border-t border-line">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <p className="text-xs text-warn">
                    Faltan cargar (estaban en {prevMonthName}):
                  </p>
                  <button type="button" onClick={() => setLoadingFixed(true)}
                    className="h-9 px-3 -my-1 rounded-lg bg-brand hover:bg-brand-hover text-white text-xs font-semibold flex-shrink-0">
                    Cargar {fixedPending.length === 1 ? 'el fijo' : `los ${fixedPending.length}`}
                  </button>
                </div>
                <div className="divide-y divide-line">
                  {fixedPending.map(t => (
                    <div key={t.id} className="flex items-center justify-between py-1.5 text-sm">
                      <span className="text-ink-700 truncate">{t.description}</span>
                      <span className="text-ink-500 flex-shrink-0 ml-3 num">
                        {formatCurrency(Number(t.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fixedTx.length === 0 && fixedPending.length === 0 && (
              <p className="text-xs text-ink-500 mt-3">
                Tocá <b>Cargar fijos</b>: te muestra lo que se repite todos los meses para
                cargarlo de una vez y dejarlo marcado. También podés marcarlos con ↻ en Movimientos.
              </p>
            )}
          </div>

          {/* Presupuesto */}
          <div className="bg-surface rounded-2xl border border-line p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink-900">
                Presupuesto de {MESES[month - 1]}
              </h3>
              <Link href="/presupuestos" className="text-xs text-ink-500 hover:text-ink-700">Ver</Link>
            </div>
            {!plan.hasBudget ? (
              <div>
                <p className="text-sm text-ink-700">Todavía no armaste el plan de {MESES[month - 1]}.</p>
                <Link href="/presupuestos/editar"
                  className="inline-flex items-center h-11 mt-3 px-4 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-medium">
                  Armar el plan en un minuto
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-sm text-ink-700">
                  <span className="num text-lg font-semibold text-ink-900">{formatCurrency(plan.spentTotal)}</span>
                  {' '}de <span className="num">{formatCurrency(plan.plannedTotal)}</span> · {Math.round(planPct * 100)} %
                </p>
                <div className="relative h-2 mt-2 rounded-full bg-muted">
                  <div className={`h-full rounded-full ${planPct > 1 ? 'bg-neg-fill' : planPct > 0.9 ? 'bg-warn' : 'bg-brand'}`}
                    style={{ width: `${Math.min(planPct, 1) * 100}%` }} />
                  {planProgress > 0 && planProgress < 1 && (
                    <div className="absolute -top-1 -bottom-1 w-0.5 rounded bg-ink-900" style={{ left: `${planProgress * 100}%` }}
                      title="Donde deberías ir hoy" aria-hidden="true" />
                  )}
                </div>
                <p className="text-xs text-ink-500 mt-2">
                  {overCats.length > 0
                    ? <span className="text-neg">{overCats.length} {overCats.length === 1 ? 'categoría excedida' : 'categorías excedidas'}</span>
                    : 'Ninguna categoría excedida'}
                  {planLeft > 0 && <> · te quedan <span className="num">{formatCurrency(planLeft)}</span> de lo variable</>}
                </p>
              </div>
            )}
          </div>

          {/* Últimos movimientos */}
          <div className="bg-surface rounded-2xl border border-line p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-ink-900">Últimos movimientos</h3>
              <Link href="/movimientos" className="text-xs text-ink-500 hover:text-ink-700">
                Ver {txCount}
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="text-sm text-ink-500 py-4 text-center">Sin movimientos</p>
            ) : (
              <div className="divide-y divide-line">
                {recent.map(t => (
                  <div key={t.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm text-ink-900 truncate">{t.description}</p>
                        {t.is_recurring && <RecurringBadge />}
                      </div>
                      <p className="text-[11px] text-ink-500">
                        {t.category_name || 'Sin categoría'} · {t.date}
                      </p>
                    </div>
                    <span className={`text-sm flex-shrink-0 ml-3 ${
                      t.type === 'income' ? 'text-pos' : 'text-neg'
                    } num`}>
                      {t.type === 'income' ? '+' : '−'}{formatCurrency(Number(t.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          </>
        )}
      </div>

      <LoadFixedSheet open={loadingFixed} onClose={() => setLoadingFixed(false)} year={year} month={month} />
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
      <div className="ml-4 mt-1 mb-2 pl-3 border-l-2 border-line">
        <p className="text-xs text-ink-500 py-2">
          No hay movimientos para mostrar en esta categoría.
        </p>
      </div>
    )
  }

  return (
    <div className="ml-4 mt-1 mb-2 pl-3 border-l-2 border-line animate-fade-in">
      <div className="flex items-center justify-between text-[11px] text-ink-500 py-1.5">
        <span>{txs.length} {txs.length === 1 ? 'movimiento' : 'movimientos'}</span>
        <span className="num">
          {formatCurrency(sum)}
        </span>
      </div>

      <div className="divide-y divide-line">
        {txs.map(t => (
          <div key={t.id} className="flex items-start justify-between gap-3 py-1.5">
            <div className="min-w-0">
              <p className="text-[13px] text-ink-700 truncate">
                {t.description}
                {t.installments_total > 1 && (
                  <span className="text-ink-500">
                    {' '}({t.installment_number}/{t.installments_total})
                  </span>
                )}
              </p>
              <p className="text-[11px] text-ink-500 truncate">
                {t.is_recurring && <><span className="text-info">Fijo</span> · </>}
                {shortDate(t.date)}
                {t.subcategory_name && <> · {t.subcategory_name}</>}
                {' · '}{t.account_name}
              </p>
            </div>
            <span className="text-[13px] text-ink-900 flex-shrink-0 num">
              {formatCurrency(Number(t.amount))}
            </span>
          </div>
        ))}
      </div>

      {mismatch && (
        <p className="text-[11px] text-warn py-1.5">
          El detalle suma {formatCurrency(sum)} y la categoría {formatCurrency(total)}.
          Puede haber gastos cargados en una subcategoría.
        </p>
      )}
    </div>
  )
}
