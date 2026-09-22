'use client'
import { useState, useMemo } from 'react'
import { Repeat, Trash2 } from 'lucide-react'
import { getTransactions, deleteTransactionsForUndo, restoreTransactions, updateTransaction } from '@/lib/api'
import QuickAddModal from '@/components/forms/QuickAddModal'
import { useAppStore } from '@/store/useAppStore'
import { formatCurrency } from '@/lib/format'
import { exportTransactionsToExcel } from '@/lib/exportImport'
import RecurringBadge from '@/components/RecurringBadge'
import { ErrorState, SkeletonLine } from '@/components/ui/States'
import { useMonthData } from '@/lib/useMonthData'
import Sheet from '@/components/ui/Sheet'
import toast from 'react-hot-toast'
import type { TransactionFull } from '@/types'

const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function monthRange(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const last = new Date(year, month, 0).getDate()
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` }
}

function dayLabel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${DIAS[dt.getDay()]} ${d} de ${MESES[m - 1]}`
}

async function loadMonth(year: number, month: number) {
  const { from, to } = monthRange(year, month)
  const { data } = await getTransactions({ date_from: from, date_to: to }, 5000, 0)
  return data || []
}

type TypeFilter = 'all' | 'expense' | 'income' | 'recurring'
type AmountFilter = 'any' | 'gt50' | 'gt100' | 'gt500'

export default function MovimientosPage() {
  const { accounts, categories, selectedMonth, setQuickAddOpen, notifyDataChanged } = useAppStore()
  const { year, month } = selectedMonth

  const { data, error, reload, setData: setAll } = useMonthData(loadMonth)
  const all = useMemo(() => data ?? [], [data])
  const loading = data === null
  // Movimiento abierto en el formulario de edición (null = cerrado).
  const [editing, setEditing] = useState<TransactionFull | null>(null)
  // Cuota que se quiere borrar: se pregunta si solo esa o todo el grupo.
  const [deletingGroup, setDeletingGroup] = useState<TransactionFull | null>(null)

  // Filtros
  const [q, setQ] = useState('')
  // ?categoria=sin (desde "Atención" en el Resumen) abre filtrando lo que no tiene categoría.
  const [catFilter, setCatFilter] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('categoria') === 'sin' ? 'none' : ''
  )
  const [accFilter, setAccFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [amountFilter, setAmountFilter] = useState<AmountFilter>('any')
  const [grouped, setGrouped] = useState(true)

  // Aplicar filtros en memoria
  const filtered = useMemo(() => {
    return all.filter(t => {
      if (typeFilter === 'recurring') {
        if (!t.is_recurring) return false
      } else if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (catFilter === 'none') {
        if (t.type === 'transfer' || t.category_id) return false
      } else if (catFilter && t.category_id !== catFilter) return false
      if (accFilter && t.account_id !== accFilter) return false
      if (q) {
        const s = q.toLowerCase()
        const inDesc = t.description?.toLowerCase().includes(s)
        const inCat = t.category_name?.toLowerCase().includes(s)
        const inAmount = String(t.amount).includes(s)
        if (!inDesc && !inCat && !inAmount) return false
      }
      if (amountFilter !== 'any') {
        const min = amountFilter === 'gt50' ? 50000 : amountFilter === 'gt100' ? 100000 : 500000
        if (Number(t.amount) < min) return false
      }
      return true
    })
  }, [all, q, catFilter, accFilter, typeFilter, amountFilter])

  const totals = useMemo(() => {
    let inc = 0, exp = 0, incN = 0, expN = 0
    for (const t of filtered) {
      if (t.type === 'income') { inc += Number(t.amount); incN++ }
      else if (t.type === 'expense') { exp += Number(t.amount); expN++ }
    }
    return { inc, exp, incN, expN, net: inc - exp }
  }, [filtered])

  // Agrupar por día
  const byDay = useMemo(() => {
    const map = new Map<string, TransactionFull[]>()
    for (const t of filtered) {
      if (!map.has(t.date)) map.set(t.date, [])
      map.get(t.date)!.push(t)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  // Borrar sin preguntar y con "Deshacer" durante unos segundos, en vez de
  // confirm() (A5). Las cuotas preguntan antes si es una o todo el grupo.
  function handleDelete(t: TransactionFull) {
    if (t.installments_total > 1) setDeletingGroup(t)
    else remove(t, 'one')
  }

  async function remove(t: TransactionFull, scope: 'one' | 'group') {
    setDeletingGroup(null)
    try {
      const rows = await deleteTransactionsForUndo(
        scope === 'group' ? { group: t.parent_transaction_id || t.id } : { id: t.id }
      )
      notifyDataChanged()
      const what = scope === 'group' ? `${rows.length} cuotas eliminadas` : 'Movimiento eliminado'
      toast(tt => (
        <span className="flex items-center gap-3">
          <span>{what}</span>
          <button
            onClick={async () => {
              toast.dismiss(tt.id)
              try {
                await restoreTransactions(rows)
                notifyDataChanged()
                toast.success('Recuperado')
              } catch (e: any) { toast.error(e.message || 'No se pudo recuperar') }
            }}
            className="font-semibold underline underline-offset-2 py-1"
          >
            Deshacer
          </button>
        </span>
      ), { duration: 6000 })
    } catch (e: any) { toast.error(e.message || 'No se pudo eliminar') }
  }

  // Marcar / desmarcar como fijo. Se actualiza en pantalla al toque y, si
  // falla el guardado, se vuelve atrás.
  async function handleToggleRecurring(t: TransactionFull) {
    const next = !t.is_recurring
    setAll(prev => prev.map(x => x.id === t.id ? { ...x, is_recurring: next } : x))
    try {
      await updateTransaction(t.id, { is_recurring: next })
      toast.success(next ? `"${t.description}" marcado como fijo` : 'Ya no es fijo')
    } catch (e: any) {
      setAll(prev => prev.map(x => x.id === t.id ? { ...x, is_recurring: !next } : x))
      toast.error(e.message)
    }
  }

  const rootCats = categories.filter(c => !c.parent_id)

  return (
    <div className="space-y-3">
      {error && data && <ErrorState compact onRetry={reload} />}

      {/* Barra de filtros.
          En el celular: buscador a lo ancho y los selects en 2 columnas, en vez
          de una fila que se desarmaba y empujaba la pagina a lo ancho. */}
      <div className="space-y-2">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar descripción, monto o comercio"
          className="w-full md:flex-1 md:min-w-[220px] border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-brand bg-surface"
        />
        <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:flex-wrap">
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="min-w-0 border border-line rounded-lg px-3 py-2 text-sm bg-surface outline-none focus:border-brand">
            <option value="">Todas las categorías</option>
            <option value="none">Sin categoría</option>
            {rootCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={accFilter} onChange={e => setAccFilter(e.target.value)}
            className="min-w-0 border border-line rounded-lg px-3 py-2 text-sm bg-surface outline-none focus:border-brand">
            <option value="">Todas las cuentas</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as TypeFilter)}
            className={`min-w-0 border rounded-lg px-3 py-2 text-sm outline-none ${
              typeFilter !== 'all' ? 'border-brand text-pos bg-brand-soft' : 'border-line bg-surface'
            }`}>
            <option value="all">Todo</option>
            <option value="expense">Solo gastos</option>
            <option value="income">Solo ingresos</option>
            <option value="recurring">Solo fijos</option>
          </select>
          <select value={amountFilter} onChange={e => setAmountFilter(e.target.value as AmountFilter)}
            className={`min-w-0 border rounded-lg px-3 py-2 text-sm outline-none ${
              amountFilter !== 'any' ? 'border-brand text-pos bg-brand-soft' : 'border-line bg-surface'
            }`}>
            <option value="any">Cualquier monto</option>
            <option value="gt50">Más de $50.000</option>
            <option value="gt100">Más de $100.000</option>
            <option value="gt500">Más de $500.000</option>
          </select>
          {/* En el celular ya está el botón "+" flotante del layout. */}
          <button
            onClick={() => setQuickAddOpen(true)}
            className="hidden md:block bg-brand hover:bg-brand-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Movimiento
          </button>
        </div>
      </div>

      {/* Totales de la selección */}
      <div className="bg-surface rounded-2xl border border-line px-4 md:px-5 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* gap-8 fijo hacia los lados no entraba en 360px: en el celular van
            apilados, con ingresos y gastos en dos columnas. */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-8">
          <div>
            <p className="text-[11px] text-ink-500">Resultado de la selección</p>
            <p className={`text-xl font-semibold break-words ${totals.net >= 0 ? 'text-pos' : 'text-neg'} num`}>
              {totals.net >= 0 ? '+' : '−'}$ {formatCurrency(Math.abs(totals.net)).replace(/^\$\s?/, '')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-8">
            <div>
              <p className="text-[11px] text-ink-500">Ingresos</p>
              <p className="text-base text-ink-900 break-words num">
                {formatCurrency(totals.inc)} <span className="text-ink-500 text-xs">· {totals.incN}</span>
              </p>
            </div>
            <div>
              <p className="text-[11px] text-ink-500">Gastos</p>
              <p className="text-base text-ink-900 break-words num">
                {formatCurrency(totals.exp)} <span className="text-ink-500 text-xs">· {totals.expN}</span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setGrouped(!grouped)}
            className="flex-1 md:flex-none border border-line rounded-lg px-3 py-2 md:py-1.5 text-sm text-ink-700 hover:bg-surface-2">
            {grouped ? 'Agrupar por día' : 'Lista simple'}
          </button>
          <button onClick={() => exportTransactionsToExcel(filtered)}
            className="flex-1 md:flex-none border border-line rounded-lg px-3 py-2 md:py-1.5 text-sm text-ink-700 hover:bg-surface-2">
            Exportar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-surface rounded-2xl border border-line overflow-hidden">
        {/* Encabezado: solo en escritorio. En el celular cada movimiento se
            muestra como tarjeta de dos líneas, sin columnas. */}
        <div className="hidden md:flex items-center gap-3 px-5 py-2.5 bg-surface-2 border-b border-line text-[11px] tracking-wide text-ink-500 font-medium">
          <span className="w-6" />
          <span className="flex-1">DESCRIPCIÓN</span>
          <span className="w-36">CATEGORÍA</span>
          <span className="w-32">CUENTA</span>
          <span className="w-32 text-right">MONTO</span>
          <span className="w-14" />
        </div>

        {error && !data ? (
          <ErrorState onRetry={reload} />
        ) : loading ? (
          <RowsSkeleton />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-ink-500 py-10 text-center">
            Sin movimientos con estos filtros
          </p>
        ) : grouped ? (
          byDay.map(([date, txs]) => {
            const dayTotal = txs.reduce((s, t) =>
              s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0)
            return (
              <div key={date}>
                <div className="flex items-center justify-between px-4 md:px-5 py-2 bg-surface-2 border-b border-line">
                  <span className="text-xs text-ink-500">{dayLabel(date)}</span>
                  <span className={`text-xs ${dayTotal >= 0 ? 'text-pos' : 'text-ink-500'} num`}>
                    {dayTotal >= 0 ? '+' : '−'}{formatCurrency(Math.abs(dayTotal))}
                  </span>
                </div>
                {txs.map(t => <Row key={t.id} t={t} onDelete={() => handleDelete(t)}
                  onToggleRecurring={() => handleToggleRecurring(t)} onEdit={() => setEditing(t)} />)}
              </div>
            )
          })
        ) : (
          filtered.map(t => <Row key={t.id} t={t} onDelete={() => handleDelete(t)}
            onToggleRecurring={() => handleToggleRecurring(t)} onEdit={() => setEditing(t)} showDate />)
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="text-xs text-ink-500 text-center">
          {filtered.length} movimientos · {MESES[month - 1]} {year}
        </p>
      )}

      <Sheet
        open={!!deletingGroup}
        title="Eliminar cuotas"
        onRequestClose={() => setDeletingGroup(null)}
      >
        {deletingGroup && (
          <div className="pb-5 space-y-2">
            <p className="text-sm text-ink-700 pb-2">
              “{deletingGroup.description}” es la cuota {deletingGroup.installment_number} de {deletingGroup.installments_total}.
            </p>
            <button onClick={() => remove(deletingGroup, 'one')}
              className="w-full h-12 rounded-xl border border-line text-sm font-medium text-ink-900 hover:bg-surface-2">
              Solo esta cuota
            </button>
            <button onClick={() => remove(deletingGroup, 'group')}
              className="w-full h-12 rounded-xl bg-neg-fill text-white text-sm font-medium">
              Las {deletingGroup.installments_total} cuotas
            </button>
          </div>
        )}
      </Sheet>

      <QuickAddModal
        open={!!editing}
        transaction={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

// Filas grises con la forma de un día de movimientos, mientras carga el mes.
function RowsSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="px-4 md:px-5 py-2 bg-surface-2 border-b border-line">
        <SkeletonLine className="h-3 w-32" />
      </div>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 md:px-5 py-3 border-b border-line">
          <SkeletonLine className="w-5 h-5 flex-shrink-0" />
          <SkeletonLine className={`h-4 ${i % 2 ? 'w-1/3' : 'w-1/2'}`} />
          <SkeletonLine className="h-4 w-20 ml-auto" />
        </div>
      ))}
    </div>
  )
}

function Row({ t, onDelete, onToggleRecurring, onEdit, showDate }: {
  t: TransactionFull; onDelete: () => void; onToggleRecurring: () => void; onEdit: () => void
  showDate?: boolean
}) {
  const isIncome = t.type === 'income'
  const canBeRecurring = t.type !== 'transfer'
  const recurringLabel = t.is_recurring ? 'Quitar de gastos fijos' : 'Marcar como gasto fijo'

  // Las columnas fijas (w-36 + w-32 + w-32 + flex-1) pedían unos 700px de ancho.
  // En un celular de 360px eso estiraba TODA la página y dejaba el contenido
  // apretado en una franja con el resto en blanco: eso es lo que se veía en la
  // captura. Ahora hay dos vistas: tarjeta en el celular, tabla en escritorio.
  return (
    <>
      {/* ---------- Celular ---------- */}
      {/* Tocar el movimiento abre el formulario para corregirlo. */}
      <div onClick={onEdit} role="button" aria-label={`Editar ${t.description}`}
        className="md:hidden flex items-start gap-3 px-4 py-3 border-b border-line active:bg-surface-2 cursor-pointer">
        <div className="w-5 h-5 rounded flex-shrink-0 mt-0.5"
          style={{ background: (t.category_color || '#D1D5DB') + '40' }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm text-ink-900 truncate">{t.description}</p>
            <span className={`text-sm flex-shrink-0 ${isIncome ? 'text-pos' : 'text-ink-900'} num`}>
              {isIncome ? '+' : '−'}{formatCurrency(Number(t.amount))}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-ink-500 min-w-0">
            {t.category_name && (
              <span className="px-1.5 py-0.5 rounded bg-muted text-ink-700 truncate max-w-[45%]">
                {t.category_name}
              </span>
            )}
            {t.is_recurring && <RecurringBadge />}
            <span className="truncate">{t.account_name}</span>
            {showDate && <span className="flex-shrink-0">· {t.date}</span>}
          </div>
        </div>

        {/* En touch no existe el hover, así que los botones se ven siempre. */}
        {canBeRecurring && (
          <button onClick={e => { e.stopPropagation(); onToggleRecurring() }} aria-label={recurringLabel} title={recurringLabel}
            className={`px-1 flex-shrink-0 mt-0.5 ${t.is_recurring ? 'text-info' : 'text-ink-500 active:text-info'}`}>
            <Repeat size={14} />
          </button>
        )}
        <button onClick={e => { e.stopPropagation(); onDelete() }} aria-label={`Eliminar ${t.description}`}
          className="text-ink-500 active:text-neg p-2.5 -my-2 -mr-2.5 flex-shrink-0">
          <Trash2 size={15} />
        </button>
      </div>

      {/* ---------- Escritorio ---------- */}
      <div onClick={onEdit} title="Click para editar"
        className="hidden md:flex items-center gap-3 px-5 py-2.5 border-b border-line hover:bg-surface-2 group transition-colors cursor-pointer">
        <div className="w-6 flex-shrink-0">
          <div className="w-5 h-5 rounded"
            style={{ background: (t.category_color || '#D1D5DB') + '40' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm text-ink-900 truncate">{t.description}</p>
            {t.is_recurring && <RecurringBadge />}
          </div>
          {showDate && <p className="text-[11px] text-ink-500">{t.date}</p>}
        </div>
        <div className="w-36 flex-shrink-0">
          {t.category_name && (
            <span className="inline-block px-2 py-0.5 rounded text-xs text-ink-700 bg-muted truncate max-w-full">
              {t.category_name}
            </span>
          )}
        </div>
        <span className="w-32 text-sm text-ink-500 truncate flex-shrink-0">{t.account_name}</span>
        <span className={`w-32 text-right text-sm flex-shrink-0 ${isIncome ? 'text-pos' : 'text-ink-900'} num`}>
          {isIncome ? '+' : '−'}{formatCurrency(Number(t.amount))}
        </span>
        <div className="w-14 flex items-center justify-end gap-1 flex-shrink-0">
          {canBeRecurring && (
            <button onClick={e => { e.stopPropagation(); onToggleRecurring() }} aria-label={recurringLabel} title={recurringLabel}
              className={`p-1 transition-all ${t.is_recurring
                ? 'text-info hover:text-info'
                : 'text-ink-500 hover:text-info opacity-0 group-hover:opacity-100'}`}>
              <Repeat size={14} />
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); onDelete() }} aria-label={`Eliminar ${t.description}`}
            className="p-1 text-ink-500 hover:text-neg opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </>
  )
}
