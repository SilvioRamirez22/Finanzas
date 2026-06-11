'use client'
import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Search, Filter, Plus, ChevronDown, Trash2, Edit2, X } from 'lucide-react'
import { getTransactions, deleteTransaction, deleteInstallmentGroup } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import { formatCurrency, formatDate, typeColors } from '@/lib/format'
import { exportTransactionsToExcel, exportTransactionsToCSV } from '@/lib/exportImport'
import toast from 'react-hot-toast'
import type { TransactionFull, SearchFilters, TransactionType } from '@/types'

const LIMIT = 30

export default function MovimientosPage() {
  const { accounts, categories, setQuickAddOpen } = useAppStore()
  const [transactions, setTransactions] = useState<TransactionFull[]>([])
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({ type: 'all', status: 'all' })

  const load = useCallback(async (reset = false) => {
    setLoading(true)
    try {
      const { data } = await getTransactions(filters, LIMIT, reset ? 0 : offset)
      if (reset) {
        setTransactions(data)
        setOffset(LIMIT)
      } else {
        setTransactions(prev => [...prev, ...data])
        setOffset(o => o + LIMIT)
      }
      setHasMore(data.length === LIMIT)
    } finally {
      setLoading(false)
    }
  }, [filters, offset])

  useEffect(() => { load(true) }, [filters])

  async function handleDelete(t: TransactionFull) {
    if (!confirm('¿Eliminar este movimiento?')) return
    try {
      if (t.installments_total > 1) {
        const all = confirm('¿Eliminar todas las cuotas del mismo grupo?')
        if (all) {
          await deleteInstallmentGroup(t.parent_transaction_id || t.id)
        } else {
          await deleteTransaction(t.id)
        }
      } else {
        await deleteTransaction(t.id)
      }
      toast.success('Eliminado')
      load(true)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  // Agrupar por fecha
  const grouped = transactions.reduce<Record<string, TransactionFull[]>>((acc, t) => {
    const key = t.date
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Movimientos</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition-colors ${
              showFilters ? 'bg-gray-100 border-gray-300 text-gray-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Filter size={14} />
            Filtros
          </button>
          <button
            onClick={() => setQuickAddOpen(true)}
            className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-xl text-sm hover:bg-emerald-700 transition-colors"
          >
            <Plus size={14} />
            Agregar
          </button>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
              <select
                value={filters.type || 'all'}
                onChange={e => setFilters(f => ({ ...f, type: e.target.value as any }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm"
              >
                <option value="all">Todos</option>
                <option value="income">Ingresos</option>
                <option value="expense">Gastos</option>
                <option value="transfer">Transferencias</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Cuenta</label>
              <select
                value={filters.account_id || ''}
                onChange={e => setFilters(f => ({ ...f, account_id: e.target.value || undefined }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm"
              >
                <option value="">Todas</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Categoría</label>
              <select
                value={filters.category_id || ''}
                onChange={e => setFilters(f => ({ ...f, category_id: e.target.value || undefined }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm"
              >
                <option value="">Todas</option>
                {categories.filter(c => !c.parent_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Desde</label>
              <input type="date" value={filters.date_from || ''}
                onChange={e => setFilters(f => ({ ...f, date_from: e.target.value || undefined }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Hasta</label>
              <input type="date" value={filters.date_to || ''}
                onChange={e => setFilters(f => ({ ...f, date_to: e.target.value || undefined }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm" />
            </div>
          </div>
          <button
            onClick={() => setFilters({ type: 'all', status: 'all' })}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <X size={12} /> Limpiar filtros
          </button>
        </div>
      )}

      {/* Lista agrupada por fecha */}
      {Object.entries(grouped).map(([date, txs]) => (
        <div key={date} className="mb-4">
          <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
            {formatDate(date)}
          </p>
          <div className="space-y-1">
            {txs.map(t => (
              <TransactionRow key={t.id} t={t} onDelete={() => handleDelete(t)} />
            ))}
          </div>
        </div>
      ))}

      {/* Load more */}
      {hasMore && (
        <button
          onClick={() => load(false)}
          disabled={loading}
          className="w-full py-3 text-sm text-gray-500 hover:text-gray-700 border border-dashed border-gray-200 rounded-2xl hover:bg-gray-50 transition-colors mt-2"
        >
          {loading ? 'Cargando...' : 'Cargar más'}
        </button>
      )}

      {!loading && transactions.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No hay movimientos</p>
          <button onClick={() => setQuickAddOpen(true)} className="mt-2 text-emerald-600 text-sm hover:underline">
            Agregar el primero
          </button>
        </div>
      )}

      {/* Export buttons */}
      {transactions.length > 0 && (
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={() => exportTransactionsToExcel(transactions)}
            className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Exportar Excel
          </button>
          <button
            onClick={() => exportTransactionsToCSV(transactions)}
            className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Exportar CSV
          </button>
        </div>
      )}
    </div>
  )
}

function TransactionRow({ t, onDelete }: { t: TransactionFull; onDelete: () => void }) {
  const sign = t.type === 'expense' ? '-' : t.type === 'income' ? '+' : '↔'
  const amtColor = t.type === 'expense' ? 'text-red-500' : t.type === 'income' ? 'text-emerald-600' : 'text-blue-500'

  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-3 py-2.5 hover:border-gray-200 group transition-all">
      {/* Color dot */}
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ background: t.category_color || '#D1D5DB' }} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">{t.description}</p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">
          {t.category_name && `${t.category_name}${t.subcategory_name ? ` · ${t.subcategory_name}` : ''} · `}
          {t.account_name}
          {t.installments_total > 1 && ` · Cuota ${t.installment_number}/${t.installments_total}`}
        </p>
      </div>

      {/* Monto */}
      <span className={`text-sm font-semibold flex-shrink-0 ${amtColor}`}>
        {sign}{formatCurrency(t.amount, 'ARS', true)}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onDelete} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
