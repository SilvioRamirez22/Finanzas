'use client'
import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { getAccounts, upsertAccount, deleteAccount, adjustAccountBalance, setInitialBalance } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import { formatCurrency } from '@/lib/format'
import { Plus, Edit2, Trash2, X, Wallet, CreditCard, Building2, Smartphone, Scale } from 'lucide-react'
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
  // Cuenta a la que se le está ajustando el saldo (null = nadie).
  const [adjusting, setAdjusting] = useState<Account | null>(null)

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

  // Sin saldo inicial, "saldo" no es la plata que tenés: es la suma de todo lo
  // que cargaste desde que empezaste a usar la app. Si además da negativo, es
  // seguro que falta configurarlo.
  const sinConfigurar = accounts.filter(a => Number(a.initial_balance) === 0 && a.current_balance < 0)
  const necesitaAjuste = !loading && accounts.length > 0 && sinConfigurar.length > 0

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Cuentas</h1>
          <p className="text-sm text-ink-500">Balance total: <span className={`font-semibold ${totalBalance >= 0 ? 'text-pos' : 'text-neg'}`}>{formatCurrency(totalBalance, 'ARS', true)}</span></p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-1.5 bg-brand text-white px-3 py-2 rounded-xl text-sm hover:bg-brand-hover transition-colors"
        >
          <Plus size={14} /> Nueva
        </button>
      </div>

      {necesitaAjuste && (
        <div className="mb-4 rounded-2xl border border-line bg-warn-soft p-4">
          <p className="text-sm font-medium text-warn">
            Los saldos no arrancan de ningún lado
          </p>
          <p className="text-sm text-warn mt-1">
            {sinConfigurar.length === 1
              ? `"${sinConfigurar[0].name}" no tiene saldo inicial, así que lo que ves no es la plata que hay: es la suma de todo lo cargado.`
              : `${sinConfigurar.length} cuentas no tienen saldo inicial, así que lo que ves no es la plata que hay: es la suma de todo lo cargado.`}
            {' '}Decí cuánto tenés hoy en cada una con <b>Ajustar saldo</b> y los números empiezan a cerrar.
          </p>
          <button
            onClick={() => setAdjusting(sinConfigurar[0])}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-warn px-3 py-2 text-sm font-medium text-white hover:bg-warn"
          >
            <Scale size={15} /> Ajustar {sinConfigurar[0].name}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {accounts.map(acc => {
          const Icon = typeIcons[acc.type] || Wallet
          const sinSaldoInicial = Number(acc.initial_balance) === 0 && acc.current_balance < 0
          return (
            <div key={acc.id}
              className="flex items-center gap-3 bg-surface rounded-2xl border border-line px-4 py-3 hover:border-line group transition-all"
              style={{ borderLeftColor: acc.color, borderLeftWidth: 3 }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: acc.color + '20' }}>
                <Icon size={18} style={{ color: acc.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-900">{acc.name}</p>
                <p className="text-xs text-ink-500">{typeLabels[acc.type]}{acc.currency !== 'ARS' ? ` · ${acc.currency}` : ''}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${acc.current_balance < 0 ? 'text-neg' : 'text-ink-900'}`}>
                  {formatCurrency(acc.current_balance, acc.currency)}
                </p>
                {sinSaldoInicial ? (
                  <button onClick={() => setAdjusting(acc)}
                    className="text-xs text-warn underline underline-offset-2 hover:text-warn">
                    sin saldo inicial
                  </button>
                ) : acc.type === 'credit_card' && acc.credit_limit ? (
                  <p className="text-xs text-ink-500">
                    Límite: {formatCurrency(acc.credit_limit, acc.currency, true)}
                  </p>
                ) : null}
              </div>
              {/* En el celular no hay hover: las acciones se ven siempre. */}
              <div className="flex gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity ml-1">
                <button onClick={() => setAdjusting(acc)}
                  aria-label={`Ajustar saldo de ${acc.name}`} title="Ajustar saldo"
                  className="p-2.5 text-ink-500 hover:text-pos transition-colors rounded-lg hover:bg-brand-soft">
                  <Scale size={16} />
                </button>
                <button onClick={() => { setEditing(acc); setShowForm(true) }}
                  aria-label={`Editar ${acc.name}`} title="Editar"
                  className="p-2.5 text-ink-500 hover:text-info transition-colors rounded-lg hover:bg-info-soft">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(acc)}
                  aria-label={`Desactivar ${acc.name}`} title="Desactivar"
                  className="p-2.5 text-ink-500 hover:text-neg transition-colors rounded-lg hover:bg-neg-soft">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )
        })}

        {!loading && accounts.length === 0 && (
          <div className="text-center py-12 text-ink-500 text-sm">
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

      {adjusting && (
        <AdjustBalance
          account={adjusting}
          onClose={() => setAdjusting(null)}
          onSuccess={() => { setAdjusting(null); load() }}
        />
      )}
    </div>
  )
}

// Ajustar el saldo de una cuenta: en vez de pedir el saldo inicial (que hay que
// calcular a mano), pregunta cuánta plata hay hoy y despeja el inicial para que
// el número cierre. No toca ningún movimiento.
function AdjustBalance({ account, onClose, onSuccess }: {
  account: Account
  onClose: () => void
  onSuccess: () => void
}) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const target = value === '' ? null : parseFloat(value)
  const valido = target !== null && !isNaN(target)
  // Lo que se va a guardar como saldo inicial para que el actual dé "target".
  const nuevoInicial = valido
    ? target - Number(account.current_balance) + Number(account.initial_balance)
    : null

  async function save() {
    if (!valido) return
    setSaving(true)
    try {
      await adjustAccountBalance(account.id, target!)
      toast.success(`Saldo de ${account.name} ajustado`)
      onSuccess()
    } catch (e: any) {
      toast.error(e.message || 'No pudimos guardar el ajuste')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="ajuste-titulo"
        className="relative bg-surface w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 shadow-xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 id="ajuste-titulo" className="font-semibold">Ajustar saldo · {account.name}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="p-2 -mr-2 text-ink-500 hover:text-ink-700">
            <X size={18} />
          </button>
        </div>

        <div className="rounded-xl bg-surface-2 p-3 text-sm text-ink-700">
          Hoy la app calcula{' '}
          <b className={account.current_balance < 0 ? 'text-neg' : 'text-ink-900'}>
            {formatCurrency(account.current_balance, account.currency)}
          </b>{' '}
          sumando tus movimientos
          {Number(account.initial_balance) === 0 && <>, sin ningún saldo de partida</>}.
        </div>

        <div className="mt-4">
          <label htmlFor="saldo-real" className="text-sm text-ink-700 mb-1.5 block font-medium">
            ¿Cuánta plata tenés hoy en esta cuenta?
          </label>
          <div className="flex items-center gap-2 rounded-xl border-2 border-line px-4 py-3 focus-within:border-brand">
            <span className="text-xl text-ink-500">$</span>
            <input
              id="saldo-real"
              ref={inputRef}
              type="number"
              step="0.01"
              inputMode="decimal"
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save() }}
              placeholder="0"
              className="flex-1 text-xl font-semibold text-ink-900 outline-none bg-transparent placeholder-ink-500"
            />
          </div>
          <p className="text-xs text-ink-500 mt-2">
            {account.type === 'credit_card'
              ? 'En una tarjeta, la deuda va en negativo (ej: −180000).'
              : 'Mirá el homebanking o contá la plata: el número de hoy, sin centavos si no querés.'}
          </p>
        </div>

        {valido && (
          <p className="mt-4 text-sm text-pos bg-brand-soft rounded-xl p-3">
            Se guarda un saldo de partida de{' '}
            <b>{formatCurrency(nuevoInicial!, account.currency)}</b> para que la cuenta muestre{' '}
            <b>{formatCurrency(target!, account.currency)}</b>. Tus movimientos no se tocan.
          </p>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 border border-line rounded-xl py-3 text-sm text-ink-700 hover:bg-surface-2">
            Cancelar
          </button>
          <button onClick={save} disabled={!valido || saving}
            className="flex-1 bg-brand text-white rounded-xl py-3 text-sm font-medium hover:bg-brand-hover disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar saldo'}
          </button>
        </div>
      </div>
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
      const inicial = parseFloat(data.initial_balance) || 0
      await upsertAccount({
        ...(account?.id ? { id: account.id } : {}),
        name: data.name,
        type: data.type,
        currency: data.currency,
        // Al crear, el saldo inicial va en el alta. Al editar se guarda aparte,
        // porque hay que mover el saldo actual junto con él (el trigger de la
        // base solo recalcula cuando cambia un movimiento).
        ...(account?.id ? {} : { initial_balance: inicial }),
        credit_limit: data.credit_limit ? parseFloat(data.credit_limit) : null,
        closing_day: data.closing_day ? parseInt(data.closing_day) : null,
        due_day: data.due_day ? parseInt(data.due_day) : null,
        color: data.color,
        exclude_from_totals: data.exclude_from_totals,
      })
      if (account?.id) await setInitialBalance(account.id, inicial)
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
      <div className="relative bg-surface w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{isNew ? 'Nueva cuenta' : 'Editar cuenta'}</h2>
          <button onClick={onClose}><X size={18} className="text-ink-500" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-xs text-ink-500 mb-1 block">Nombre</label>
            <input {...register('name', { required: true })}
              placeholder="Ej: Banco Galicia"
              className="w-full border border-line rounded-xl px-4 py-3 text-sm outline-none focus:border-brand" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-500 mb-1 block">Tipo</label>
              <select {...register('type')}
                className="w-full border border-line rounded-xl px-3 py-2.5 text-sm bg-surface outline-none focus:border-brand">
                {Object.entries(typeLabels).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-ink-500 mb-1 block">Moneda</label>
              <select {...register('currency')}
                className="w-full border border-line rounded-xl px-3 py-2.5 text-sm bg-surface outline-none focus:border-brand">
                <option value="ARS">ARS — Peso</option>
                <option value="USD">USD — Dólar</option>
                <option value="EUR">EUR — Euro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-ink-500 mb-1 block">
              {isNew ? 'Saldo inicial' : 'Saldo de partida'}
            </label>
            <input {...register('initial_balance')} type="number" step="0.01"
              className="w-full border border-line rounded-xl px-4 py-3 text-sm outline-none focus:border-brand" />
            <p className="text-xs text-ink-500 mt-1">
              {isNew
                ? 'La plata que ya hay en la cuenta antes de cargar movimientos.'
                : 'Cambia el saldo de la cuenta sin tocar los movimientos. Si no sabés cuánto poner, usá "Ajustar saldo" y escribí lo que tenés hoy.'}
            </p>
          </div>

          {selectedType === 'credit_card' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-ink-500 mb-1 block">Límite</label>
                <input {...register('credit_limit')} type="number" step="0.01"
                  placeholder="500000"
                  className="w-full border border-line rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand" />
              </div>
              <div>
                <label className="text-xs text-ink-500 mb-1 block">Día cierre</label>
                <input {...register('closing_day')} type="number" min={1} max={31}
                  placeholder="15"
                  className="w-full border border-line rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand" />
              </div>
              <div>
                <label className="text-xs text-ink-500 mb-1 block">Día vto.</label>
                <input {...register('due_day')} type="number" min={1} max={31}
                  placeholder="5"
                  className="w-full border border-line rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand" />
              </div>
            </div>
          )}

          {/* Colores */}
          <div>
            <label className="text-xs text-ink-500 mb-2 block">Color</label>
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_COLORS.map(c => (
                <button key={c} type="button"
                  onClick={() => setValue('color', c)}
                  className={`w-8 h-8 rounded-full transition-transform ${selectedColor === c ? 'scale-125 ring-2 ring-offset-1 ring-line-strong' : ''}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('exclude_from_totals')} className="rounded" />
            <span className="text-sm text-ink-700">Excluir del balance total (ej: tarjeta de crédito)</span>
          </label>

          <button type="submit" disabled={submitting}
            className="w-full bg-brand text-white py-3 rounded-xl text-sm font-medium hover:bg-brand-hover disabled:opacity-50 transition-colors">
            {submitting ? 'Guardando...' : isNew ? 'Crear cuenta' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </div>
  )
}
