'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, AlertTriangle, Check } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import {
  MESES, MESES_CORTO, closedMonths, average, savingsRate, buildInsights,
  type MonthPoint, type Series, type Insight,
} from '@/lib/seguimiento'

// Tarjetas y gráficos de Seguimiento. Los gráficos son SVG a mano: barras
// finas con puntas redondeadas, un solo eje, trama en gastos para que se
// lean sin color (docs/ux/04-GLOBAL-DASHBOARD.md §3).

const GOAL = 0.10

// "$ 2,4 M" / "$ 850 mil": para ejes, nunca para el dato principal.
function compact(n: number) {
  const a = Math.abs(n)
  if (a >= 1e6) return `$ ${(n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  if (a >= 1e3) return `$ ${Math.round(n / 1e3).toLocaleString('es-AR')} mil`
  return `$ ${Math.round(n)}`
}

function niceMax(v: number) {
  if (v <= 0) return 1
  const step = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= v) return m * step
  return 10 * step
}

const pct = (r: number) => `${(r * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const monthLabel = (p: MonthPoint) => `${cap(MESES[p.month - 1])} ${p.year}`

// Barra con las puntas de arriba redondeadas, apoyada en la base.
function barPath(x: number, w: number, base: number, top: number) {
  const h = base - top
  if (h <= 0.5) return ''
  const r = Math.min(3, w / 2, h)
  return `M${x} ${base}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + w - r}Q${x + w} ${top} ${x + w} ${top + r}V${base}Z`
}
function outlinePath(x: number, w: number, base: number, top: number) {
  if (base - top <= 0.5) return ''
  return `M${x} ${base}V${top}H${x + w}V${base}`
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(entries => setWidth(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

export interface PlanPoint {
  key: string
  month: number
  planned: number
  spent: number
  hasBudget: boolean
  inProgress: boolean
  projection: number | null
}

export default function SeguimientoContent({ series, range, selKey, setSelKey, catId, setCatId, catName, planPoints = [] }: {
  series: Series
  range: number
  selKey: string | null
  setSelKey: (k: string) => void
  catId: string | null
  setCatId: (id: string) => void
  catName: (id: string) => string
  planPoints?: PlanPoint[]
}) {
  const months = series.months
  const hasData = months.some(p => p.income > 0 || p.expense > 0)
  if (!hasData) {
    return (
      <div className="bg-surface rounded-2xl border border-line px-6 py-12 text-center">
        <p className="text-sm font-medium text-ink-900">Todavía no hay movimientos en este período</p>
        <p className="text-sm text-ink-500 mt-1">Cuando cargues ingresos y gastos, acá vas a ver cómo evolucionan.</p>
      </div>
    )
  }

  const closed = closedMonths(months)
  // Se compara contra la misma cantidad de meses, justo antes del primero cerrado.
  const all = [...series.previous, ...months]
  const firstIdx = closed.length ? all.indexOf(closed[0]) : 0
  const closedPrev = closedMonths(all.slice(Math.max(0, firstIdx - closed.length), firstIdx))
  const selected = months.find(p => p.key === selKey)
    ?? [...months].reverse().find(p => !p.inProgress && (p.income > 0 || p.expense > 0))
    ?? months[months.length - 1]
  const insights = buildInsights(series, catName)

  return (
    <>
      <div className="grid lg:grid-cols-2 gap-3 md:gap-4 items-start">
        <div className="space-y-3 md:space-y-4">
          <Averages closed={closed} previous={closedPrev} />
          <IncomeExpenseCard months={months} selected={selected} onSelect={setSelKey} />
        </div>
        <div className="space-y-3 md:space-y-4">
          <SavingsCard months={months} closed={closed} />
          <InsightsCard insights={insights} />
          <PlanCard points={planPoints} />
        </div>
      </div>
      <CategoriesCard series={series} catId={catId} setCatId={setCatId} catName={catName} />
    </>
  )
}

// ---------- Promedio por mes ----------
function Averages({ closed, previous }: { closed: MonthPoint[]; previous: MonthPoint[] }) {
  if (closed.length === 0) {
    return (
      <section className="bg-surface rounded-2xl border border-line p-4 md:p-5">
        <p className="text-[11px] font-semibold tracking-wide text-ink-500">PROMEDIO POR MES</p>
        <p className="text-sm text-ink-500 mt-2">Todavía no terminó ningún mes del período.</p>
      </section>
    )
  }
  const inc = average(closed, p => p.income)
  const exp = average(closed, p => p.expense)
  const rate = inc > 0 ? (inc - exp) / inc : 0
  // Solo se compara si el período anterior tiene la misma cantidad de meses con datos.
  const prevOk = previous.length === closed.length && previous.some(p => p.income > 0 || p.expense > 0)
  const pInc = average(previous, p => p.income)
  const pExp = average(previous, p => p.expense)
  const pRate = pInc > 0 ? (pInc - pExp) / pInc : 0
  const vs = (cur: number, old: number) => {
    if (!prevOk || old <= 0) return 'sin datos del período anterior'
    const v = (cur - old) / old
    return `${v >= 0 ? '▲' : '▼'} ${pct(Math.abs(v))} vs. los ${closed.length} meses anteriores`
  }
  const first = closed[0], last = closed[closed.length - 1]
  const rows = [
    { label: 'Ingresos', value: formatCurrency(inc), delta: vs(inc, pInc), swatch: 'bg-[var(--chart-inc)]' },
    { label: 'Gastos', value: formatCurrency(exp), delta: vs(exp, pExp), swatch: 'bg-[var(--chart-exp)]' },
    {
      label: 'Ahorro', value: pct(rate), swatch: 'bg-pos',
      delta: prevOk && pInc > 0
        ? `${rate >= pRate ? '▲' : '▼'} ${Math.abs((rate - pRate) * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} puntos vs. antes`
        : `${formatCurrency(inc - exp)} por mes`,
    },
  ]
  return (
    <section className="bg-surface rounded-2xl border border-line p-4 md:p-5">
      <p className="text-[11px] font-semibold tracking-wide text-ink-500">PROMEDIO POR MES</p>
      <p className="text-xs text-ink-500 mt-1">
        {closed.length === 1 ? `${cap(MESES[first.month - 1])}` : `De ${MESES_CORTO[first.month - 1]} a ${MESES_CORTO[last.month - 1]}`}
        {' '}({closed.length} {closed.length === 1 ? 'mes cerrado' : 'meses cerrados'})
      </p>
      <div className="mt-2 divide-y divide-line">
        {rows.map(r => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 py-2.5">
            <span className="flex items-center gap-2 text-sm text-ink-700">
              <span className={`w-2.5 h-2.5 rounded-[3px] ${r.swatch}`} aria-hidden="true" />{r.label}
            </span>
            <span className="text-right">
              <span className="block num text-xl font-semibold text-ink-900">{r.value}</span>
              <span className="block text-xs text-ink-500">{r.delta}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------- Ingresos y gastos ----------
function IncomeExpenseCard({ months, selected, onSelect }: {
  months: MonthPoint[]; selected: MonthPoint; onSelect: (k: string) => void
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const H = 170, base = 156, top = 8, L = 52
  const max = niceMax(Math.max(...months.map(p => Math.max(p.income, p.projection ?? p.expense, p.expense))))
  const y = (v: number) => base - (v / max) * (base - top)
  const plotW = Math.max(0, width - L)
  const gw = plotW / months.length
  const bw = Math.max(3, Math.min(16, (gw - 8) / 2))

  let inc = '', exp = '', proj = ''
  months.forEach((p, j) => {
    const cx = L + gw * j + gw / 2
    inc += barPath(cx - bw - 1, bw, base, y(p.income))
    exp += barPath(cx + 1, bw, base, y(p.expense))
    if (p.projection && p.projection > p.expense) proj += outlinePath(cx + 1, bw, y(p.expense), y(p.projection))
  })
  const selIdx = months.indexOf(selected)
  const net = selected.income - selected.expense
  const rate = savingsRate(selected)

  return (
    <section className="bg-surface rounded-2xl border border-line p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-ink-900">Ingresos y gastos</h2>
        <div className="flex gap-3 text-xs text-ink-700">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--chart-inc)]" />Ingresos</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm hatch-exp" />Gastos</span>
        </div>
      </div>
      <div ref={ref} className="relative mt-3" style={{ height: H + 18 }}>
        {width > 0 && (
          <svg width={width} height={H} className="block" aria-hidden="true">
            <defs>
              <pattern id="hatch-exp" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="5" height="5" fill="var(--chart-exp)" />
                <line x1="0" y1="0" x2="0" y2="5" stroke="var(--chart-hatch)" strokeWidth="1.6" />
              </pattern>
            </defs>
            {selIdx >= 0 && <rect x={L + gw * selIdx + 1} y={0} width={Math.max(0, gw - 2)} height={base} rx={6} fill="var(--chart-band)" />}
            {[max, max / 2, 0].map(v => (
              <g key={v}>
                <line x1={L} x2={width} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" />
                <text x={0} y={y(v) + 3} fontSize="10" fill="var(--ink-500)">{compact(v)}</text>
              </g>
            ))}
            <path d={inc} fill="var(--chart-inc)" />
            <path d={exp} fill="url(#hatch-exp)" />
            <path d={proj} fill="none" stroke="var(--chart-exp)" strokeWidth="1.5" strokeDasharray="3 2" />
          </svg>
        )}
        <div className="absolute top-0 bottom-0 right-0 flex" style={{ left: L }}>
          {months.map(p => {
            const on = p === selected
            return (
              <button key={p.key} type="button" onClick={() => onSelect(p.key)} aria-pressed={on}
                aria-label={`${monthLabel(p)}: ingresos ${formatCurrency(p.income)}, gastos ${formatCurrency(p.expense)}`}
                title={`${monthLabel(p)}\nIngresos ${formatCurrency(p.income)}\nGastos ${formatCurrency(p.expense)}`}
                className="flex-1 min-w-0 flex items-end justify-center rounded-md">
                <span className={`text-[11px] leading-4 ${on ? 'font-bold text-ink-900' : 'text-ink-500'}`}>
                  {months.length > 6 ? MESES_CORTO[p.month - 1].slice(0, 1).toUpperCase() : MESES_CORTO[p.month - 1]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-surface-2 p-3 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-ink-900">{monthLabel(selected)}</span>
          <span className="text-xs text-ink-500">
            {selected.inProgress ? `en curso${selected.projection ? ` · proyección ${formatCurrency(selected.projection)}` : ''}`
              : rate !== null ? `ahorro ${pct(rate)}` : ''}
          </span>
        </div>
        <div className="flex justify-between text-sm"><span className="text-ink-700">Ingresos</span><span className="num text-ink-900">{formatCurrency(selected.income)}</span></div>
        <div className="flex justify-between text-sm"><span className="text-ink-700">Gastos</span><span className="num text-ink-900">{formatCurrency(selected.expense)}</span></div>
        <div className="flex justify-between text-sm pt-1.5 border-t border-line">
          <span className="text-ink-700">Te quedó</span>
          <span className={`num font-semibold ${net >= 0 ? 'text-pos' : 'text-neg'}`}>{net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(net))}</span>
        </div>
      </div>
      <p className="text-xs text-ink-500 mt-2">Tocá un mes para ver el detalle. El borde punteado es la proyección del mes en curso.</p>
    </section>
  )
}

// ---------- Ahorro ----------
function SavingsCard({ months, closed }: { months: MonthPoint[]; closed: MonthPoint[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const H = 120, base = 96, top = 8, L = 40
  const rates = months.map(p => {
    if (p.inProgress && p.projection !== null && p.income > 0) return { p, r: (p.income - p.projection) / p.income, proj: true }
    return { p, r: savingsRate(p), proj: false }
  })
  const values = rates.map(x => x.r ?? 0)
  const maxR = Math.max(0.2, ...values), minR = Math.min(0, ...values)
  const span = maxR - minR
  const y = (r: number) => top + ((maxR - r) / span) * (base - top)
  const zero = y(0)
  const gw = Math.max(0, width - L) / months.length
  const bw = Math.max(4, Math.min(22, gw - 10))
  let pos = '', neg = '', proj = ''
  rates.forEach(({ r, proj: isProj }, j) => {
    if (r === null) return
    const x = L + gw * j + gw / 2 - bw / 2
    if (isProj) { proj += r >= 0 ? outlinePath(x, bw, zero, y(r)) : `M${x} ${zero}V${y(r)}H${x + bw}V${zero}`; return }
    if (r >= 0) pos += barPath(x, bw, zero, y(r))
    else neg += `M${x} ${zero}H${x + bw}V${y(r)}H${x}Z`
  })
  const closedRates = closed.map(savingsRate).filter((r): r is number => r !== null)
  const hit = closedRates.filter(r => r >= GOAL).length

  return (
    <section className="bg-surface rounded-2xl border border-line p-4 md:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-900">Cuánto ahorraste</h2>
        <span className="text-xs text-ink-500">% de lo que entró</span>
      </div>
      <p className="text-sm text-ink-700 mt-1">
        {closedRates.length
          ? `Llegaste a la meta del ${Math.round(GOAL * 100)} % en ${hit} de ${closedRates.length} ${closedRates.length === 1 ? 'mes' : 'meses'}.`
          : 'Todavía no hay meses cerrados para comparar.'}
      </p>
      <div ref={ref} className="relative mt-3" style={{ height: H + 18 }}>
        {width > 0 && (
          <svg width={width} height={H} className="block" aria-hidden="true">
            <line x1={L} x2={width} y1={zero} y2={zero} stroke="var(--chart-grid)" />
            <text x={0} y={zero + 3} fontSize="10" fill="var(--ink-500)">0 %</text>
            <text x={0} y={y(maxR) + 3} fontSize="10" fill="var(--ink-500)">{Math.round(maxR * 100)} %</text>
            <path d={pos} fill="var(--pos)" />
            <path d={neg} fill="var(--neg)" />
            <path d={proj} fill="none" stroke="var(--pos)" strokeWidth="1.5" strokeDasharray="3 2" />
            <line x1={L} x2={width} y1={y(GOAL)} y2={y(GOAL)} stroke="var(--ink-700)" strokeWidth="1.5" strokeDasharray="5 3" />
            <text x={width - 2} y={y(GOAL) - 4} fontSize="10" textAnchor="end" fill="var(--ink-700)">meta {Math.round(GOAL * 100)} %</text>
          </svg>
        )}
        <div className="absolute bottom-0 right-0 flex" style={{ left: L }}>
          {rates.map(({ p, r }) => (
            <span key={p.key} title={r === null ? `${monthLabel(p)}: sin ingresos` : `${monthLabel(p)}: ${pct(r)}`}
              className="flex-1 text-center text-[11px] leading-4 text-ink-500">
              {months.length > 6 ? MESES_CORTO[p.month - 1].slice(0, 1).toUpperCase() : MESES_CORTO[p.month - 1]}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- Gasto contra el plan ----------
function PlanCard({ points }: { points: PlanPoint[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const withPlan = points.filter(p => p.hasBudget)
  if (withPlan.length === 0) {
    return (
      <section className="bg-surface rounded-2xl border border-line p-4 md:p-5">
        <h2 className="text-sm font-semibold text-ink-900">Gasto contra el plan</h2>
        <p className="text-sm text-ink-700 mt-1">
          Cuando armes el plan de un mes, acá vas a ver en qué meses te pasaste y por cuánto.
        </p>
        <Link href="/presupuestos/editar" className="inline-flex items-center h-11 mt-2 text-sm font-medium text-brand-ink underline underline-offset-2">
          Armar el plan
        </Link>
      </section>
    )
  }

  const H = 136, base = 116, top = 6, L = 52
  const max = niceMax(Math.max(...points.map(p => Math.max(p.spent, p.planned, p.inProgress && p.projection ? p.projection : 0))))
  const y = (v: number) => base - (v / max) * (base - top)
  const gw = Math.max(0, width - L) / points.length
  const bw = Math.max(4, Math.min(22, gw - 10))
  let noPlan = '', inside = '', excess = '', proj = '', ticks = ''
  points.forEach((p, j) => {
    const x = L + gw * j + gw / 2 - bw / 2
    if (!p.hasBudget) { noPlan += barPath(x, bw, base, y(p.spent)); return }
    if (p.spent > p.planned) {
      inside += `M${x} ${base}V${y(p.planned)}H${x + bw}V${base}Z`
      excess += barPath(x, bw, y(p.planned), y(p.spent))
    } else inside += barPath(x, bw, base, y(p.spent))
    if (p.inProgress && p.projection && p.projection > p.spent) proj += outlinePath(x, bw, y(p.spent), y(p.projection))
    ticks += `M${x - 4} ${y(p.planned)}H${x + bw + 4}`
  })
  const closed = withPlan.filter(p => !p.inProgress)
  const over = closed.filter(p => p.spent > p.planned).length
  const cur = withPlan.find(p => p.inProgress)
  const curDiff = cur?.projection ? cur.planned - cur.projection : null

  return (
    <section className="bg-surface rounded-2xl border border-line p-4 md:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-900">Gasto contra el plan</h2>
        <Link href="/presupuestos" className="text-xs font-medium text-brand-ink">Presupuesto</Link>
      </div>
      <p className="text-sm text-ink-700 mt-1">
        {closed.length > 0 && `Te pasaste en ${over} de ${closed.length} ${closed.length === 1 ? 'mes' : 'meses'} con plan. `}
        {cur && curDiff !== null && `${cap(MESES[cur.month - 1])} va ${formatCurrency(Math.abs(curDiff))} ${curDiff >= 0 ? 'abajo' : 'arriba'} del plan si seguís a este ritmo.`}
      </p>
      <div ref={ref} className="relative mt-3" style={{ height: H + 18 }}>
        {width > 0 && (
          <svg width={width} height={H} className="block" aria-hidden="true">
            {[max, max / 2, 0].map(v => (
              <g key={v}>
                <line x1={L} x2={width} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" />
                <text x={0} y={y(v) + 3} fontSize="10" fill="var(--ink-500)">{compact(v)}</text>
              </g>
            ))}
            <path d={noPlan} fill="var(--muted)" />
            <path d={inside} fill="var(--chart-neutral)" />
            <path d={excess} fill="var(--neg)" />
            <path d={proj} fill="none" stroke="var(--chart-neutral)" strokeWidth="1.5" strokeDasharray="3 2" />
            <path d={ticks} stroke="var(--ink-900)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
        )}
        <div className="absolute bottom-0 right-0 flex" style={{ left: L }}>
          {points.map(p => (
            <span key={p.key} className="flex-1 text-center text-[11px] leading-4 text-ink-500"
              title={p.hasBudget ? `${cap(MESES[p.month - 1])}: ${formatCurrency(p.spent)} de ${formatCurrency(p.planned)}` : `${cap(MESES[p.month - 1])}: sin plan`}>
              {points.length > 6 ? MESES_CORTO[p.month - 1].slice(0, 1).toUpperCase() : MESES_CORTO[p.month - 1]}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 mt-2 text-xs text-ink-700">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--chart-neutral)]" />Gastado</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-[3px] rounded-sm bg-ink-900" />Plan del mes</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-neg" />Arriba del plan</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-muted" />Sin plan</span>
      </div>
    </section>
  )
}

// ---------- Qué cambió ----------
const INSIGHT_STYLE: Record<Insight['kind'], { icon: typeof Check; cls: string }> = {
  up: { icon: ArrowUpRight, cls: 'bg-neg-soft text-neg' },
  down: { icon: ArrowDownRight, cls: 'bg-pos-soft text-pos' },
  warn: { icon: AlertTriangle, cls: 'bg-warn-soft text-warn' },
  ok: { icon: Check, cls: 'bg-pos-soft text-pos' },
}

function InsightsCard({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null
  return (
    <section className="bg-surface rounded-2xl border border-line p-4 md:p-5">
      <h2 className="text-sm font-semibold text-ink-900">Qué cambió</h2>
      <ul className="mt-1 divide-y divide-line">
        {insights.map(i => {
          const { icon: Icon, cls } = INSIGHT_STYLE[i.kind]
          return (
            <li key={i.title} className="flex gap-3 py-3">
              <span className={`w-8 h-8 flex-shrink-0 rounded-[10px] flex items-center justify-center ${cls}`} aria-hidden="true">
                <Icon size={16} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink-900">{i.title}</span>
                <span className="block text-[13px] leading-snug text-ink-700 mt-0.5">{i.body}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ---------- Por categoría: mapa de calor ----------
function level(ratio: number) {
  if (ratio < 0.8) return 0
  if (ratio < 0.95) return 1
  if (ratio <= 1.05) return 2
  if (ratio <= 1.2) return 3
  if (ratio <= 1.35) return 4
  return 5
}

function CategoriesCard({ series, catId, setCatId, catName }: {
  series: Series; catId: string | null; setCatId: (id: string) => void; catName: (id: string) => string
}) {
  const COLS = 6
  const offset = series.months.length - COLS
  const cols = series.months.slice(offset)
  const closedIdx = cols.map((p, k) => (!p.inProgress && closedMonths([p]).length ? k : -1)).filter(k => k >= 0)

  const rows = Array.from(series.byCategory.entries())
    .map(([id, vals]) => ({ id, vals: vals.slice(offset), total: vals.slice(offset).reduce((s, v) => s + v, 0) }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
  if (rows.length === 0) return null

  const current = rows.find(r => r.id === catId) ?? rows[0]
  const avgOf = (vals: number[]) => closedIdx.length ? closedIdx.reduce((s, k) => s + vals[k], 0) / closedIdx.length : 0

  return (
    <section className="bg-surface rounded-2xl border border-line p-4 md:p-5">
      <h2 className="text-sm font-semibold text-ink-900">Por categoría</h2>
      <p className="text-xs text-ink-500 mt-1">Cada mes contra el promedio de esa categoría. Tocá una para ver su evolución.</p>

      <div className="grid md:grid-cols-[1fr_340px] gap-4 mt-3">
        <div className="space-y-1 overflow-x-auto">
          <div className="grid grid-cols-[minmax(76px,160px)_repeat(6,minmax(36px,1fr))] gap-1 min-w-[312px]">
            <span />
            {cols.map(p => <span key={p.key} className="text-[11px] text-center text-ink-500">{MESES_CORTO[p.month - 1]}</span>)}
          </div>
          {rows.map(r => {
            const a = avgOf(r.vals)
            const on = r.id === current.id
            return (
              <div key={r.id} className="grid grid-cols-[minmax(76px,160px)_repeat(6,minmax(36px,1fr))] gap-1 min-w-[312px]">
                <button type="button" onClick={() => setCatId(r.id)} aria-pressed={on}
                  className={`h-9 px-2 rounded-lg text-left text-[13px] truncate ${on ? 'bg-brand-soft font-semibold text-ink-900' : 'text-ink-900 hover:bg-surface-2'}`}>
                  {catName(r.id)}
                </button>
                {r.vals.map((v, k) => {
                  const p = cols[k]
                  const judged = closedIdx.includes(k) && a > 0
                  const lv = judged ? level(v / a) : -1
                  return (
                    <div key={p.key}
                      title={`${catName(r.id)}, ${monthLabel(p)}: ${formatCurrency(v)}${judged ? ` (${Math.round((v / a - 1) * 100)} % vs. promedio)` : p.inProgress ? ' (en curso)' : ''}`}
                      className={`num h-9 rounded-md flex items-center justify-center text-[11px] ${lv === -1 ? 'border border-dashed border-line text-ink-500' : ''}`}
                      style={lv >= 0 ? { background: `var(--heat-${lv})`, color: `var(--heat-fg-${lv})` } : undefined}>
                      {v >= 1e6 ? `${(v / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 2 })}M` : `${Math.round(v / 1e3)}k`}
                    </div>
                  )
                })}
              </div>
            )
          })}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 text-[11px] text-ink-700">
            <span>abajo</span>
            {[0, 1, 2, 3, 4, 5].map(l => <span key={l} className="w-[18px] h-2.5 rounded-sm" style={{ background: `var(--heat-${l})` }} />)}
            <span>arriba de su promedio</span>
          </div>
        </div>

        <CategoryTrend name={catName(current.id)} vals={current.vals} cols={cols} avg={avgOf(current.vals)} closedIdx={closedIdx} />
      </div>
    </section>
  )
}

function CategoryTrend({ name, vals, cols, avg, closedIdx }: {
  name: string; vals: number[]; cols: MonthPoint[]; avg: number; closedIdx: number[]
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const H = 70, base = 62, top = 6
  const max = Math.max(...vals, avg) * 1.1 || 1
  const y = (v: number) => base - (v / max) * (base - top)
  const gw = width / vals.length, bw = Math.min(24, gw - 10)
  let bars = '', partial = ''
  vals.forEach((v, k) => {
    const x = gw * k + gw / 2 - bw / 2
    if (closedIdx.includes(k)) bars += barPath(x, bw, base, y(v))
    else partial += outlinePath(x, bw, base, y(v))
  })
  const lastK = closedIdx[closedIdx.length - 1]
  const last = lastK !== undefined ? vals[lastK] : null
  const diff = last !== null && avg > 0 ? (last - avg) / avg : null

  return (
    <div className="rounded-xl bg-surface-2 p-3 self-start">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink-900 truncate">{name}</span>
        {avg > 0 && <span className="num text-xs text-ink-500 flex-shrink-0">promedio {formatCurrency(avg)}</span>}
      </div>
      <div ref={ref} className="mt-2" style={{ height: H }}>
        {width > 0 && (
          <svg width={width} height={H} className="block" aria-hidden="true">
            <path d={bars} fill="var(--chart-neutral)" />
            <path d={partial} fill="none" stroke="var(--chart-neutral)" strokeWidth="1.5" strokeDasharray="3 2" />
            {avg > 0 && <line x1={0} x2={width} y1={y(avg)} y2={y(avg)} stroke="var(--ink-900)" strokeWidth="1.5" strokeDasharray="4 3" />}
          </svg>
        )}
      </div>
      <div className="flex">
        {cols.map(p => <span key={p.key} className="flex-1 text-center text-[11px] text-ink-500">{MESES_CORTO[p.month - 1]}</span>)}
      </div>
      {last !== null && diff !== null && (
        <p className="text-sm leading-snug text-ink-700 mt-2">
          En {MESES[cols[lastK].month - 1]} gastaste {formatCurrency(last)},{' '}
          {Math.abs(diff) < 0.05 ? 'parecido a tu promedio.' : `${Math.abs(Math.round(diff * 100))} % ${diff > 0 ? 'arriba' : 'abajo'} de tu promedio.`}
        </p>
      )}
    </div>
  )
}
