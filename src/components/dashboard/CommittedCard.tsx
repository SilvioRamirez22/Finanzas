'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { sumItems, type CommitItem, type MonthCommitments } from '@/lib/seguimiento'

// Lo primero del Resumen en el mes en curso y en los que vienen: lo que falta
// pagar (cuotas, gastos fijos y lo cargado con fecha posterior a hoy) y, con
// los ingresos del mes, cuánto queda libre. El saldo de las cuentas no está
// acá a propósito: hay plata en cuentas que no están en la app.
// Mismo cálculo que "Próximos 6 meses" de Seguimiento (commitmentsForMonth).

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

type Row = CommitItem & { estimated?: boolean }

export default function CommittedCard({ year, month, data, current }: {
  year: number
  month: number
  data: MonthCommitments
  current: boolean   // el mes en curso (si no, uno que todavía no empezó)
}) {
  const [open, setOpen] = useState<string | null>(null)
  const mes = MESES[month - 1]
  const now = new Date()
  const title = `${mes}${year !== now.getFullYear() ? ` ${year}` : ''}`
  // Un fijo que en el mes todavía no está: en el mes en curso "sin cargar", más adelante "estimado".
  const estLabel = current ? 'sin cargar' : 'estimado'
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

  const fixedRows: Row[] = [
    ...data.fixedLoaded,
    ...data.fixedEstimated.map(i => ({ ...i, estimated: true })),
  ].sort((a, b) => b.amount - a.amount)
  const groups = [
    { key: 'inst', label: 'Cuotas', rows: data.installments as Row[], note: plural(data.installments.length, 'cuota', 'cuotas') },
    {
      key: 'fixed', label: 'Gastos fijos', rows: fixedRows,
      note: [
        data.fixedLoaded.length > 0 && plural(data.fixedLoaded.length, 'ya cargado', 'ya cargados'),
        data.fixedEstimated.length > 0 && `${data.fixedEstimated.length} ${current ? 'sin cargar' : data.fixedEstimated.length === 1 ? 'estimado' : 'estimados'}`,
      ].filter(Boolean).join(' · '),
    },
    { key: 'other', label: 'Otros ya cargados', rows: data.otherLoaded as Row[], note: current ? 'con fecha después de hoy' : `con fecha de ${mes}` },
  ].filter(g => g.rows.length > 0)
  const toPay = groups.reduce((s, g) => s + sumItems(g.rows), 0)

  // Ingresos del mes: lo cobrado hasta hoy más lo que falta cobrar.
  const incomeRows: Row[] = [
    ...data.incomeLoaded,
    ...data.incomeEstimated.map(i => ({ ...i, estimated: true })),
  ].sort((a, b) => b.amount - a.amount)
  const income = data.incomeReceived + sumItems(incomeRows)
  const free = income - data.spent - toPay
  const anyEstimated = data.fixedEstimated.length > 0 || data.incomeEstimated.length > 0

  // Meses de donde salen los fijos estimados: el actual y el anterior.
  const refPrev = MESES[new Date(now.getFullYear(), now.getMonth() - 1, 1).getMonth()]
  const refCur = MESES[now.getMonth()]

  const toggle = (key: string) => setOpen(open === key ? null : key)
  const rowList = (rows: Row[]) => (
    <ul className="ml-1.5 mb-2 pl-3 border-l-2 border-line">
      {rows.map(r => (
        <li key={r.key} className="flex items-baseline justify-between gap-3 py-1.5">
          <span className="min-w-0 text-[13px] text-ink-700 truncate">
            {r.description}
            {r.installment && <span className="text-ink-500"> ({r.installment})</span>}
            {r.estimated && <span className="text-ink-500"> · {estLabel}</span>}
          </span>
          <span className={`num text-[13px] flex-shrink-0 ${r.estimated ? 'text-ink-500' : 'text-ink-900'}`}>
            {formatCurrency(r.amount)}
          </span>
        </li>
      ))}
    </ul>
  )
  // Fila de un grupo; se despliega si tiene renglones para mostrar.
  const headRow = (key: string, label: string, note: string, amount: string, expandable = true) => {
    const inner = (
      <>
        <ChevronRight size={14} aria-hidden="true"
          className={`flex-shrink-0 text-ink-500 transition-transform ${open === key ? 'rotate-90' : ''} ${expandable ? '' : 'invisible'}`} />
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-ink-900">{label}</span>
          {note && <span className="block text-xs text-ink-500 truncate">{note}</span>}
        </span>
        <span className="num text-sm font-medium text-ink-900 flex-shrink-0">{amount}</span>
      </>
    )
    const cls = 'w-[calc(100%+1rem)] min-h-[48px] flex items-center gap-2 py-2 text-left -mx-2 px-2 rounded-lg'
    return expandable
      ? <button type="button" onClick={() => toggle(key)} aria-expanded={open === key} className={`${cls} hover:bg-surface-2 active:bg-surface-2`}>{inner}</button>
      : <div className={cls}>{inner}</div>
  }

  return (
    <section className="bg-surface rounded-2xl border border-line p-4 md:p-5" aria-labelledby="committed-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="committed-title" className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
          {current ? 'Falta pagar en' : 'Comprometido en'} {title}
        </h2>
        <Link href="/seguimiento" className="text-xs text-ink-500 hover:text-ink-900 whitespace-nowrap flex-shrink-0">Próximos meses</Link>
      </div>
      <p className="num text-[28px] sm:text-3xl font-semibold mt-1 tracking-tight break-words text-ink-900">
        {formatCurrency(toPay)}
      </p>
      <p className="text-xs text-ink-500 mt-0.5">
        {toPay === 0
          ? current ? `No queda nada por pagar en ${mes}: ni cuotas ni fijos sin cargar.` : `Todavía no hay cuotas, gastos fijos ni nada cargado para ${mes}.`
          : current ? `Lo que todavía no pagaste este mes: cuotas que vencen después de hoy, fijos sin cargar y lo cargado con fecha futura.`
          : `Lo que ya sabés que vas a pagar en ${mes}: cuotas, gastos fijos y lo cargado con fecha de ese mes.`}
      </p>

      {groups.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {groups.map(g => (
            <li key={g.key}>
              {headRow(g.key, g.label, g.note, formatCurrency(sumItems(g.rows)))}
              {open === g.key && rowList(g.rows)}
            </li>
          ))}
        </ul>
      )}

      {/* Cuánto queda libre: ingresos del mes − lo gastado − lo que falta pagar. */}
      {income > 0 ? (
        <div className="mt-3 rounded-xl bg-surface-2 px-3 pt-1 pb-3">
          <ul className="divide-y divide-line">
            <li>
              {headRow('income', `Ingresos de ${mes}`,
                [
                  data.incomeReceived > 0 && `cobrado ${formatCurrency(data.incomeReceived)}`,
                  incomeRows.length > 0 && `${current ? 'falta cobrar' : data.incomeEstimated.length === incomeRows.length ? 'estimado' : 'por cobrar'} ${formatCurrency(sumItems(incomeRows))}`,
                ].filter(Boolean).join(' · '),
                formatCurrency(income), incomeRows.length > 0)}
              {open === 'income' && rowList(incomeRows)}
            </li>
            {data.spent > 0 && (
              <li className="flex items-baseline justify-between gap-3 py-2 pl-[22px] text-sm">
                <span className="text-ink-700">Ya gastado</span>
                <span className="num text-ink-900">− {formatCurrency(data.spent)}</span>
              </li>
            )}
            <li className="flex items-baseline justify-between gap-3 py-2 pl-[22px] text-sm">
              <span className="text-ink-700">{current ? 'Falta pagar' : 'Comprometido'}</span>
              <span className="num text-ink-900">− {formatCurrency(toPay)}</span>
            </li>
            <li className="flex items-baseline justify-between gap-3 pt-2.5 pl-[22px]">
              <span>
                <span className="block text-sm font-semibold text-ink-900">{free >= 0 ? 'Te queda libre' : 'Te falta'}</span>
                <span className="block text-xs text-ink-500">
                  {free < 0 ? 'lo comprometido supera a los ingresos del mes'
                    : current ? `para el día a día y el ahorro de lo que queda de ${mes}` : `para el día a día y el ahorro de ${mes}`}
                </span>
              </span>
              <span className={`num text-base font-semibold flex-shrink-0 ${free >= 0 ? 'text-pos' : 'text-neg'}`}>
                {formatCurrency(Math.abs(free))}
              </span>
            </li>
          </ul>
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2.5 text-xs text-ink-700">
          Para ver cuánto te queda libre, marcá tu sueldo como ingreso fijo: tocá ↻ en el ingreso, en{' '}
          <Link href="/movimientos" className="underline underline-offset-2 font-medium">Movimientos</Link>.
        </p>
      )}

      {anyEstimated && (
        <p className="text-xs text-ink-500 mt-2">
          {current
            ? `Los fijos sin cargar se estiman con el último monto de ${refPrev} ${refCur.startsWith('o') ? 'u' : 'o'} ${refCur}.`
            : `Los fijos estimados salen de los de ${refPrev} y ${refCur}, con el último monto.`}
          {' '}Cuando los cargues, cuenta lo cargado.
        </p>
      )}
    </section>
  )
}
