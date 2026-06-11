'use client'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { getAccounts, upsertAccount, deleteAccount } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import { formatCurrency } from '@/lib/format'
import { Plus, Edit2, Trash2, X, Wallet, CreditCard, Building2, Smartphone } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Account, AccountType } from '@/types'

const typeLabels: Record<AccountType, string> = {
  cash: 'Efectivo',
  bank: 'Banco',
  digital_wallet: 'Billetera digital',
  credit_card: 'Tarjeta de crédito',
  investment: 'Inversión',
  savings: 'Ahorro',
  other: 'Otro',
}

const typeIcons: Record<AccountType, any> = {
  cash: Wallet,
  bank: Building2,
  digital_wallet: Smartphone,
  credit_card: CreditCard,
  investment: Wallet,
  savings: Wallet,
  other: Wallet,
}

const ACCOUNT_COLORS = ['#1D9E75','#378ADD','#D85A30','#534AB7','#BA7517','#E24B4A','#1CCDFF','#888780']

export default function CuentasPage() {
  const { setAccounts: setStoreAccounts } = useAppStore()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await getAccounts()
      setAccounts(data)
      setStoreAccounts(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(acc: Account) {
    if (!confirm(`¿Desactivar la cuenta "${acc.name}"? Los movimientos se conservan.`)) return
    try {
      await deleteAccount(acc.id)
      toast.success('Cuenta desactivada')
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const totalBalance = accounts
    .filter(a => !a.exclude_from_totals)
    .reduce((s, a) => s + a.current_balance, 0)

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Cuentas</h1>
          <p className="text-sm text-gray-500">Balance total: <span className={`font-semibold ${totalBalance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(totalBalance, 'ARS', true)}</span></p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-xl text-sm hover:bg-emerald-700 transition-colors"
        >
          <Plus size={14} /> Nueva
        </button>
      </div>

      <div className="space-y-2">
        {accounts.map(acc => {
          const Icon = typeIcons[acc.type] || Wallet
          return (
            <div key={acc.id}
              className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3 hover:border-gray-200 group transition-all"
              style={{ borderLeftColor: acc.color, borderLeftWidth: 3 }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: acc.color + '20' }}>
                <Icon size={18} style={{ color: acc.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{acc.name}</p>
                <p className="text-xs text-gray-400">{typeLabels[acc.type]}{acc.currency !== 'ARS' ? ` · ${acc.currency}` : ''}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${acc.current_balance < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                  {formatCurrency(acc.current_balance, acc.currency)}
                </p>
                {acc.type === 'credit_card' && acc.credit_limit && (
                  <p className="text-xs text-gray-400">
                    Límite: {formatCurrency(acc.credit_limit, acc.currency, true)}
                  </p>
                )}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                <button onClick={() => { setEditing(acc); setShowForm(true) }}
                  className="p-1.5 text-gray-300 hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-50">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => handleDelete(acc)}
                  className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )
        })}

        {!loading && accounts.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            No hay cuentas configuradas
          </div>
        )}
      </div>

      {showForm && (
        <AccountForm
          account={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSuccess={() => { setShowForm(false); setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function AccountForm({ account, onClose, onSuccess }: {
  account: Account | null
  onClose: () => void
  onSuccess: () => void
}) {
  const isNew = !account?.id
  const { register, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      name: account?.name || '',
      type: account?.type || 'bank' as AccountType,
      currency: account?.currency || 'ARS',
      initial_balance: account?.initial_balance || 0,
      credit_limit: account?.credit_limit || '',
      closing_day: account?.closing_day || '',
      due_day: account?.due_day || '',
      color: account?.color || ACCOUNT_COLORS[0],
      exclude_from_totals: account?.exclude_from_totals || false,
    }
  })
  const [submitting, setSubmitting] = useState(false)
  const selectedColor = watch('color')
  const selectedType = watch('type')

  async function onSubmit(data: any) {
    setSubmitting(true)
    try {
      await upsertAccount({
        ...(account?.id ? { id: account.id } : {}),
        name: data.name,
        type: data.type,
        currency: data.currency,
        initial_balance: parseFloat(data.initial_balance) || 0,
        credit_limit: data.credit_limit ? parseFloat(data.credit_limit) : null,
        closing_day: data.closing_day ? parseInt(data.closing_day) : null,
        due_day: data.due_day ? parseInt(data.due_day) : null,
        color: data.color,
        exclude_from_totals: data.exclude_from_totals,
      })
      toast.success(isNew ? 'Cuenta creada' : 'Cuenta actualizada')
      onSuccess()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{isNew ? 'Nueva cuenta' : 'Editar cuenta'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nombre</label>
            <input {...register('name', { required: true })}
              placeholder="Ej: Banco Galicia"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
              <select {...register('type')}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-emerald-400">
                {Object.entries(typeLabels).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Moneda</label>
              <select {...register('currency')}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-emerald-400">
                <option value="ARS">ARS — Peso</option>
                <option value="USD">USD — Dólar</option>
                <option value="EUR">EUR — Euro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              {isNew ? 'Saldo inicial' : 'Saldo inicial (no modifica historial)'}
            </label>
            <input {...register('initial_balance')} type="number" step="0.01"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400" />
          </div>

          {selectedType === 'credit_card' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Límite</label>
                <input {...register('credit_limit')} type="number" step="0.01"
                  placeholder="500000"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Día cierre</label>
                <input {...register('closing_day')} type="number" min={1} max={31}
                  placeholder="15"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Día vto.</label>
                <input {...register('due_day')} type="number" min={1} max={31}
                  placeholder="5"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
              </div>
            </div>
          )}

          {/* Colores */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Color</label>
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_COLORS.map(c => (
                <button key={c} type="button"
                  onClick={() => setValue('color', c)}
                  className={`w-8 h-8 rounded-full transition-transform ${selectedColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('exclude_from_totals')} className="rounded" />
            <span className="text-sm text-gray-600">Excluir del balance total (ej: tarjeta de crédito)</span>
          </label>

          <button type="submit" disabled={submitting}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
            {submitting ? 'Guardando...' : isNew ? 'Crear cuenta' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </div>
  )
}
