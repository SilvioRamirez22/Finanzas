'use client'
import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { getTransactions } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import { formatCurrency, formatDate } from '@/lib/format'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import type { TransactionFull, SearchFilters } from '@/types'

export default function BuscarPage() {
  const { accounts, categories, paymentMethods } = useAppStore()
  const [results, setResults] = useState<TransactionFull[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({})
  const debounceRef = useRef<NodeJS.Timeout>()

  async function search(f: SearchFilters) {
    if (!f.query && !f.category_id && !f.account_id && !f.date_from && !f.date_to && !f.type) {
      setResults([])
      setSearched(false)
      return
    }
    setLoading(true)
    try {
      const { data } = await getTransactions(f, 100, 0)
      setResults(data)
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }

  function handleQueryChange(q: string) {
    const newFilters = { ...filters, query: q }
    setFilters(newFilters)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(newFilters), 350)
  }

  function handleFilterChange(key: keyof SearchFilters, value: string) {
    const newFilters = { ...filters, [key]: value || undefined }
    setFilters(newFilters)
    search(newFilters)
  }

  function clearAll() {
    setFilters({})
    setResults([])
    setSearched(false)
  }

  const totalAmount = results.reduce((s, t) =>
    t.type === 'expense' ? s - t.amount : t.type === 'income' ? s + t.amount : s, 0)

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Buscar</h1>

      {/* Barra de búsqueda */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 focus-within:border-emerald-400 transition-colors">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={filters.query || ''}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="Buscar por descripción..."
            className="flex-1 text-sm outline-none bg-transparent"
          />
          {filters.query && (
            <button onClick={() => handleQueryChange('')}>
              <X size={14} className="text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition-colors ${
            showAdvanced ? 'bg-gray-100 border-gray-300' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          <SlidersHorizontal size={14} />
          Filtros
        </button>
      </div>

      {/* Filtros avanzados */}
      {showAdvanced && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
              <select value={filters.type || ''}
                onChange={e => handleFilterChange('type', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white">
                <option value="">Todos</option>
                <option value="income">Ingresos</option>
                <option value="expense">Gastos</option>
                <option value="transfer">Transferencias</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Cuenta</label>
              <select value={filters.account_id || ''}
                onChange={e => handleFilterChange('account_id', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white">
                <option value="">Todas</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Categoría</label>
              <select value={filters.category_id || ''}
                onChange={e => handleFilterChange('category_id', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white">
                <option value="">Todas</option>
                {categories.filter(c => !c.parent_id).map(c =>
                  <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Medio de pago</label>
              <select value={filters.payment_method_id || ''}
                onChange={e => handleFilterChange('payment_method_id', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white">
                <option value="">Todos</option>
                {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Desde</label>
              <input type="date" value={filters.date_from || ''}
                onChange={e => handleFilterChange('date_from', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Hasta</label>
              <input type="date" value={filters.date_to || ''}
                onChange={e => handleFilterChange('date_to', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Monto mínimo</label>
              <input type="number" value={filters.amount_min || ''}
                onChange={e => handleFilterChange('amount_min', e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Monto máximo</label>
              <input type="number" value={filters.amount_max || ''}
                onChange={e => handleFilterChange('amount_max', e.target.value)}
                placeholder="∞"
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm" />
            </div>
          </div>
          <button onClick={clearAll}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <X size={12} /> Limpiar todo
          </button>
        </div>
      )}

      {/* Resultados */}
      {loading && (
        <div className="text-center py-8 text-gray-400 text-sm">Buscando...</div>
      )}

      {searched && !loading && (
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-gray-500">{results.length} resultado{results.length !== 1 ? 's' : ''}</p>
          {results.length > 0 && (
            <p className={`text-sm font-medium ${totalAmount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {totalAmount >= 0 ? '+' : ''}{formatCurrency(totalAmount, 'ARS', true)}
            </p>
          )}
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-1.5">
          {results.map(t => {
            const sign = t.type === 'expense' ? '-' : t.type === 'income' ? '+' : '↔'
            const amtColor = t.type === 'expense' ? 'text-red-500' : t.type === 'income' ? 'text-emerald-600' : 'text-blue-500'
            return (
              <div key={t.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-3 py-2.5">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: t.category_color || '#D1D5DB' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{t.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(t.date)} · {t.account_name}
                    {t.category_name && ` · ${t.category_name}`}
                  </p>
                </div>
                <span className={`text-sm font-semibold flex-shrink-0 ${amtColor}`}>
                  {sign}{formatCurrency(t.amount, 'ARS', true)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Search size={32} className="mx-auto mb-2 text-gray-200" />
          <p className="text-sm">Sin resultados para esta búsqueda</p>
        </div>
      )}

      {!searched && !loading && (
        <div className="text-center py-12 text-gray-300">
          <Search size={40} className="mx-auto mb-2" />
          <p className="text-sm">Escribí para buscar movimientos</p>
        </div>
      )}
    </div>
  )
}
