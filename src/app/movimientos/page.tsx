'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { getTransactions, deleteTransaction, deleteInstallmentGroup } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import { formatCurrency } from '@/lib/format'
import { exportTransactionsToExcel } from '@/lib/exportImport'
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

type TypeFilter = 'all' | 'expense' | 'income'
type AmountFilter = 'any' | 'gt50' | 'gt100' | 'gt500'

export default function MovimientosPage() {
  const { accounts, categories, selectedMonth, setQuickAddOpen } = useAppStore()
  const { year, month } = selectedMonth

  const [all, setAll] = useState<TransactionFull[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [q, setQ] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [accFilter, setAccFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [amountFilter, setAmountFilter] = useState<AmountFilter>('any')
  const [grouped, setGrouped] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { from, to } = monthRange(year, month)
      const { data } = await getTransactions({ date_from: from, date_to: to }, 5000, 0)
      setAll(data || [])
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])

  // Aplicar filtros en memoria
  const filtered = useMemo(() => {
    return all.filter(t => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (catFilter && t.category_id !== catFilter) return false
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

  async function handleDelete(t: TransactionFull) {
    if (!confirm(`¿Eliminar "${t.description}"?`)) return
    try {
      if (t.installments_total > 1) {
        const all = confirm('¿Eliminar todas las cuotas del grupo?')
        if (all) await deleteInstallmentGroup(t.parent_transaction_id || t.id)
        else await deleteTransaction(t.id)
      } else {
        await deleteTransaction(t.id)
      }
      toast.success('Eliminado')
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const rootCats = categories.filter(c => !c.parent_id)

  return (
    <div className="space-y-3">
      {/* Barra de filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar descripción, monto o comercio"
          className="flex-1 min-w-[220px] border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 bg-white"
        />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500">
          <option value="">Todas las categorías</option>
          {rootCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={accFilter} onChange={e => setAccFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500">
          <option value="">Todas las cuentas</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as TypeFilter)}
          className={`border rounded-lg px-3 py-2 text-sm outline-none ${
            typeFilter !== 'all' ? 'border-emerald-500 text-emerald-800 bg-emerald-50' : 'border-gray-200 bg-white'
          }`}>
          <option value="all">Todo</option>
          <option value="expense">Solo gastos</option>
          <option value="income">Solo ingresos</option>
        </select>
        <select value={amountFilter} onChange={e => setAmountFilter(e.target.value as AmountFilter)}
          className={`border rounded-lg px-3 py-2 text-sm outline-none ${
            amountFilter !== 'any' ? 'border-emerald-500 text-emerald-800 bg-emerald-50' : 'border-gray-200 bg-white'
          }`}>
          <option value="any">Cualquier monto</option>
          <option value="gt50">Más de $50.000</option>
          <option value="gt100">Más de $100.000</option>
          <option value="gt500">Más de $500.000</option>
        </select>
        <button
          onClick={() => setQuickAddOpen(true)}
          className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Movimiento
        </button>
      </div>

      {/* Totales de la selección */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-8">
          <div>
            <p className="text-[11px] text-gray-400">Resultado de la selección</p>
            <p className={`text-xl font-semibold ${totals.net >= 0 ? 'text-emerald-800' : 'text-red-600'}`}
               style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
              {totals.net >= 0 ? '+' : '−'}$ {formatCurrency(Math.abs(totals.net)).replace(/^\$\s?/, '')}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400">Ingresos</p>
            <p className="text-base text-gray-900" style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
              {formatCurrency(totals.inc)} <span className="text-gray-400 text-xs">· {totals.incN}</span>
            </p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400">Gastos</p>
            <p className="text-base text-gray-900" style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
              {formatCurrency(totals.exp)} <span className="text-gray-400 text-xs">· {totals.expN}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setGrouped(!grouped)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
            {grouped ? 'Agrupar por día' : 'Lista simple'}
          </button>
          <button onClick={() => exportTransactionsToExcel(filtered)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
            Exportar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-center gap-3 px-5 py-2.5 bg-gray-50 border-b border-gray-200 text-[11px] tracking-wide text-gray-400 font-medium">
          <span className="w-6" />
          <span className="flex-1">DESCRIPCIÓN</span>
          <span className="w-36">CATEGORÍA</span>
          <span className="w-32">CUENTA</span>
          <span className="w-32 text-right">MONTO</span>
          <span className="w-8" />
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-10 text-center">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 py-10 text-center">
            Sin movimientos con estos filtros
          </p>
        ) : grouped ? (
          byDay.map(([date, txs]) => {
            const dayTotal = txs.reduce((s, t) =>
              s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0)
            return (
              <div key={date}>
                <div className="flex items-center justify-between px-5 py-2 bg-gray-50/70 border-b border-gray-100">
                  <span className="text-xs text-gray-500">{dayLabel(date)}</span>
                  <span className={`text-xs ${dayTotal >= 0 ? 'text-emerald-700' : 'text-gray-500'}`}
                        style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                    {dayTotal >= 0 ? '+' : '−'}{formatCurrency(Math.abs(dayTotal))}
                  </span>
                </div>
                {txs.map(t => <Row key={t.id} t={t} onDelete={() => handleDelete(t)} />)}
              </div>
            )
          })
        ) : (
          filtered.map(t => <Row key={t.id} t={t} onDelete={() => handleDelete(t)} showDate />)
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          {filtered.length} movimientos · {MESES[month - 1]} {year}
        </p>
      )}
    </div>
  )
}

function Row({ t, onDelete, showDate }: {
  t: TransactionFull; onDelete: () => void; showDate?: boolean
}) {
  const isIncome = t.type === 'income'
  return (
    <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-100 hover:bg-gray-50/60 group transition-colors">
      <div className="w-6 flex-shrink-0">
        <div className="w-5 h-5 rounded"
          style={{ background: (t.category_color || '#D1D5DB') + '40' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">{t.description}</p>
        {showDate && <p className="text-[11px] text-gray-400">{t.date}</p>}
      </div>
      <div className="w-36 flex-shrink-0">
        {t.category_name && (
          <span className="inline-block px-2 py-0.5 rounded text-xs text-gray-600 bg-gray-100 truncate max-w-full">
            {t.category_name}
          </span>
        )}
      </div>
      <span className="w-32 text-sm text-gray-500 truncate flex-shrink-0">{t.account_name}</span>
      <span className={`w-32 text-right text-sm flex-shrink-0 ${isIncome ? 'text-emerald-700' : 'text-gray-900'}`}
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
        {isIncome ? '+' : '−'}{formatCurrency(Number(t.amount))}
      </span>
      <button onClick={onDelete}
        className="w-8 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all text-sm flex-shrink-0">
        ···
      </button>
    </div>
  )
}
