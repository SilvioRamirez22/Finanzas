'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/useAppStore'
import {
  createTransaction, updateTransactionFromForm, updateInstallments,
  deleteTransaction, deleteInstallmentGroup,
} from '@/lib/api'
import { getQuickAddHints, suggestDescriptions, EMPTY_HINTS, type QuickAddHints, type DescriptionHint } from '@/lib/quickAddHints'
import { todayISO, formatCurrency } from '@/lib/format'
import Sheet from '@/components/ui/Sheet'
import Keypad from './Keypad'
import CategoryIcon from '@/components/CategoryIcon'
import type { TransactionFormData, TransactionFull, TransactionType, Category } from '@/types'

// Carga y edición de movimientos (docs/ux/03-FLUJO-MOVIMIENTO.md).
// Un gasto típico: monto en el teclado propio, una categoría y guardar. La
// cuenta ya viene elegida (la última usada) y la fecha es hoy.

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const TYPE_LABEL: Record<TransactionType, string> = { expense: 'Gasto', income: 'Ingreso', transfer: 'Transferencia' }
const SAVE_LABEL: Record<TransactionType, string> = { expense: 'Guardar gasto', income: 'Guardar ingreso', transfer: 'Guardar transferencia' }
const SAVED_LABEL: Record<TransactionType, string> = { expense: 'Gasto guardado', income: 'Ingreso guardado', transfer: 'Transferencia guardada' }
const INSTALLMENT_CHIPS = [3, 6, 12]

const pad2 = (n: number) => String(n).padStart(2, '0')
// "2026-09" de "2026-09-22"
const monthKey = (iso: string) => iso.slice(0, 7)

function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`
}

// "septiembre", o "septiembre 2025" si no es el año de refYear
function monthName(year: number, month: number, refYear: number) {
  return year === refYear ? MESES[month - 1] : `${MESES[month - 1]} ${year}`
}

// "31 ago"
function shortDay(iso: string) {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MESES_CORTO[m - 1]}`
}

// La fecha que conviene sugerir para el mes que se está mirando: hoy si es
// este mes, el último día si es un mes pasado, el primero si es uno futuro.
function suggestedDate(year: number, month: number) {
  const today = todayISO()
  const key = `${year}-${pad2(month)}`
  if (monthKey(today) === key) return today
  if (key < monthKey(today)) return `${key}-${pad2(new Date(year, month, 0).getDate())}`
  return `${key}-01`
}

// "1250000" -> "1.250.000"; "1250.5" -> "1.250,5"
function formatAmount(raw: string) {
  if (!raw) return ''
  const [int, dec] = raw.split('.')
  const intFmt = Number(int || '0').toLocaleString('es-AR')
  return dec !== undefined ? `${intFmt},${dec}` : intFmt
}

// Lo que se tipea en el campo de escritorio ("1.250.000,50") a "1250000.50".
function parseTypedAmount(text: string) {
  const clean = text.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')
  const [int, ...rest] = clean.split('.')
  const dec = rest.join('').slice(0, 2)
  const intPart = int.replace(/^0+(?=\d)/, '').slice(0, 12)
  return rest.length ? `${intPart || '0'}.${dec}` : intPart
}

interface Form {
  type: TransactionType
  amount: string            // dígitos, con "." decimal opcional
  date: string
  account_id: string
  transfer_to_account_id: string
  category_id: string
  subcategory_id: string
  payment_method_id: string
  description: string
  notes: string
  installments: number      // 1 = sin cuotas
  is_recurring: boolean
}

function blankForm(date: string): Form {
  return {
    type: 'expense', amount: '', date, account_id: '', transfer_to_account_id: '',
    category_id: '', subcategory_id: '', payment_method_id: '', description: '', notes: '',
    installments: 1, is_recurring: false,
  }
}

function formFromTransaction(t: TransactionFull): Form {
  return {
    type: t.type,
    amount: String(Number(t.amount)),
    date: t.date,
    account_id: t.account_id,
    transfer_to_account_id: t.transfer_to_account_id || '',
    category_id: t.category_id || '',
    subcategory_id: t.subcategory_id || '',
    payment_method_id: t.payment_method_id || '',
    description: t.description.replace(/\s*\(\d+\/\d+\)\s*$/, ''),
    notes: t.notes || '',
    installments: t.installments_total > 1 ? t.installments_total : 1,
    is_recurring: t.is_recurring,
  }
}

function useIsMobile() {
  const query = '(max-width: 767px)'
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMobile(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile
}

interface QuickAddProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  // Si viene, el formulario edita ese movimiento en vez de crear uno nuevo.
  transaction?: TransactionFull | null
}

export default function QuickAddModal({ open, onClose, onSuccess, transaction }: QuickAddProps) {
  const isEdit = !!transaction
  const {
    accounts, categories, paymentMethods, profile, categoriesWithSubs,
    selectedMonth, setSelectedMonth, notifyDataChanged, dataVersion,
  } = useAppStore()
  const isMobile = useIsMobile()

  const [form, setForm] = useState<Form>(() => blankForm(todayISO()))
  const [initial, setInitial] = useState<Form>(form)
  const [hints, setHints] = useState<QuickAddHints>(EMPTY_HINTS)
  const [moreOpen, setMoreOpen] = useState(false)
  const [allCats, setAllCats] = useState(false)
  const [pickDate, setPickDate] = useState(false)
  const [customInstallments, setCustomInstallments] = useState(false)
  const [textFocus, setTextFocus] = useState(false)
  const [descFocus, setDescFocus] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savedTick, setSavedTick] = useState(false)
  // Al editar cuotas: copiar los cambios a todo el grupo o solo a esta cuota.
  const [applyToAll, setApplyToAll] = useState(true)
  const amountInputRef = useRef<HTMLInputElement>(null)
  const paymentTouched = useRef(false)
  const accountTouched = useRef(false)

  const activeAccounts = accounts.filter(a => a.is_active)

  // ---- Abrir: formulario limpio (o el movimiento a editar) + lo aprendido ----
  useEffect(() => {
    if (!open) return
    const start = transaction ? formFromTransaction(transaction) : blankForm(todayISO())
    // Arranca con una cuenta ya elegida; cuando llegan las sugerencias se
    // cambia por la última usada, salvo que la persona ya haya elegido otra.
    if (!transaction) start.account_id = [...activeAccounts].sort((a, b) => a.sort_order - b.sort_order)[0]?.id || ''
    setForm(start)
    setInitial(start)
    setMoreOpen(!!transaction)
    setAllCats(false)
    setPickDate(false)
    setCustomInstallments(!!transaction && ![1, ...INSTALLMENT_CHIPS].includes(start.installments))
    setConfirmDiscard(false)
    setApplyToAll(true)
    setTextFocus(false)
    paymentTouched.current = !!transaction
    accountTouched.current = false

    let cancelled = false
    // Cuenta por defecto: la última usada para gastos (sale de Supabase, así
    // vale en todos los dispositivos). Sin datos, la más usada o la primera.
    function applyDefaults(h: QuickAddHints) {
      if (cancelled) return
      setHints(h)
      if (transaction) return
      const last = h.lastAccountByType.expense
      const fallback = [...activeAccounts].sort(
        (a, b) => (h.accountUses[b.id] || 0) - (h.accountUses[a.id] || 0) || a.sort_order - b.sort_order
      )[0]
      const accountId = (last && activeAccounts.some(a => a.id === last) ? last : fallback?.id) || ''
      if (!accountId) return
      const apply = (f: Form) => accountTouched.current ? f : {
        ...f, account_id: accountId,
        payment_method_id: paymentTouched.current ? f.payment_method_id : h.lastPaymentByAccount[accountId] || '',
      }
      setForm(apply)
      setInitial(apply)
    }
    getQuickAddHints(dataVersion)
      .then(applyDefaults)
      .catch(e => { console.error('Error cargando sugerencias:', e); applyDefaults(EMPTY_HINTS) })
    return () => { cancelled = true }
  }, [open, transaction])

  // Si las cuentas llegan después de abrir, elegir una apenas estén.
  useEffect(() => {
    if (!open || transaction || form.account_id || accountTouched.current) return
    const first = [...activeAccounts].sort((a, b) => a.sort_order - b.sort_order)[0]
    if (!first) return
    const pick = (f: Form) => (f.account_id ? f : { ...f, account_id: first.id })
    setForm(pick)
    setInitial(pick)
  }, [open, accounts])

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(f => ({ ...f, [key]: value }))

  function setType(type: TransactionType) {
    setForm(f => ({
      ...f, type,
      // Las categorías de gasto no sirven para un ingreso y al revés.
      category_id: '', subcategory_id: '',
      installments: type === 'expense' ? f.installments : 1,
      is_recurring: type === 'transfer' ? false : f.is_recurring,
    }))
    setAllCats(false)
  }

  function setAccount(id: string) {
    accountTouched.current = true
    setForm(f => ({
      ...f, account_id: id,
      transfer_to_account_id: f.transfer_to_account_id === id ? '' : f.transfer_to_account_id,
      payment_method_id: paymentTouched.current ? f.payment_method_id : hints.lastPaymentByAccount[id] || '',
    }))
  }

  // ---- Monto ----
  function pressDigit(d: string) {
    setForm(f => {
      let a = f.amount
      if (d === '000' && (!a || a === '0')) return f
      if (a.includes('.')) {
        if (a.split('.')[1].length >= 2) return f
        return { ...f, amount: a + d.slice(0, 2 - a.split('.')[1].length) }
      }
      a = (a === '0' ? '' : a) + d
      return a.length > 12 ? f : { ...f, amount: a }
    })
  }
  const amountNum = parseFloat(form.amount) || 0

  // ---- Categorías: raíces del tipo, las más usadas primero ----
  const rootCats = useMemo(() => {
    if (form.type === 'transfer') return []
    return categories
      .filter(c => !c.parent_id && c.is_active && (form.type === 'income' ? c.type !== 'expense' : c.type !== 'income'))
      .sort((a, b) => (hints.categoryUses[b.id] || 0) - (hints.categoryUses[a.id] || 0) || a.sort_order - b.sort_order)
  }, [categories, form.type, hints])

  const TOP = 5
  let shownCats: Category[] = allCats ? rootCats : rootCats.slice(0, TOP)
  // La elegida siempre a la vista, aunque no esté entre las más usadas.
  const selectedRoot = rootCats.find(c => c.id === form.category_id)
  if (!allCats && selectedRoot && !shownCats.includes(selectedRoot)) shownCats = [...shownCats.slice(0, TOP - 1), selectedRoot]

  const subcats = useMemo(() => {
    const root = categoriesWithSubs().find(c => c.id === form.category_id)
    return (root?.subcategories || []).sort((a, b) => (hints.categoryUses[b.id] || 0) - (hints.categoryUses[a.id] || 0) || a.sort_order - b.sort_order)
  }, [form.category_id, categories, hints])

  function pickCategory(id: string) {
    setForm(f => f.category_id === id
      ? { ...f, category_id: '', subcategory_id: '' }
      : { ...f, category_id: id, subcategory_id: '' })
  }

  // ---- Cuentas: las más usadas primero ----
  const rankedAccounts = [...activeAccounts].sort(
    (a, b) => (hints.accountUses[b.id] || 0) - (hints.accountUses[a.id] || 0) || a.sort_order - b.sort_order
  )
  const activePayments = paymentMethods.filter(p => p.is_active).sort((a, b) => a.sort_order - b.sort_order)

  // ---- Fecha y mes visible (A2) ----
  const today = todayISO()
  const yesterday = addDaysISO(today, -1)
  const viewKey = `${selectedMonth.year}-${pad2(selectedMonth.month)}`
  const viewDate = suggestedDate(selectedMonth.year, selectedMonth.month)
  const dateChips = [
    { iso: today, label: 'Hoy' },
    { iso: yesterday, label: 'Ayer' },
    ...(viewDate !== today && viewDate !== yesterday ? [{ iso: viewDate, label: shortDay(viewDate) }] : []),
  ]
  const customDate = !dateChips.some(c => c.iso === form.date)
  const dateChanged = !transaction || transaction.date !== form.date
  const outsideView = /^\d{4}-\d{2}/.test(form.date) && monthKey(form.date) !== viewKey && dateChanged
  const dateYear = Number(form.date.slice(0, 4))
  const dateMonth = Number(form.date.slice(5, 7))

  // ---- Cuotas al editar ----
  const origTotal = transaction?.installments_total ?? 1
  const editingNumber = origTotal > 1 ? transaction!.installment_number : 1

  // ---- Descripción ----
  const suggestions = descFocus ? suggestDescriptions(hints, form.type, form.description) : []
  function applySuggestion(s: DescriptionHint) {
    const accountOk = activeAccounts.some(a => a.id === s.account_id)
    if (accountOk) accountTouched.current = true
    setForm(f => ({
      ...f,
      description: s.text,
      category_id: s.category_id || f.category_id,
      subcategory_id: s.category_id ? s.subcategory_id || '' : f.subcategory_id,
      account_id: accountOk ? s.account_id : f.account_id,
      amount: f.amount || String(s.amount),
    }))
    setDescFocus(false)
  }

  // ---- Validación: solo lo que de verdad bloquea ----
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  let blocker = ''
  if (amountNum <= 0) blocker = 'Escribí el monto'
  else if (!form.account_id) blocker = 'Elegí una cuenta'
  else if (form.type === 'transfer' && !form.transfer_to_account_id) blocker = 'Elegí la cuenta de destino'
  else if (isEdit && form.type === 'expense' && form.installments < editingNumber)
    blocker = `No puede haber menos de ${editingNumber} cuotas`

  function requestClose() {
    if (submitting) return
    if (dirty && !confirmDiscard) { setConfirmDiscard(true); return }
    onClose()
  }

  // Resumen de lo elegido, debajo del monto.
  const accountName = activeAccounts.find(a => a.id === form.account_id)?.name
  const catName = categories.find(c => c.id === form.category_id)?.name
  const subName = categories.find(c => c.id === form.subcategory_id)?.name
  const toName = activeAccounts.find(a => a.id === form.transfer_to_account_id)?.name

  function toFormData(): TransactionFormData {
    const fallbackDesc = subName || catName || (form.type === 'transfer' && toName ? `Transferencia a ${toName}` : TYPE_LABEL[form.type])
    const isTransfer = form.type === 'transfer'
    return {
      type: form.type,
      amount: form.amount,
      date: form.date,
      description: form.description.trim() || fallbackDesc,
      account_id: form.account_id,
      category_id: isTransfer ? '' : form.category_id,
      subcategory_id: isTransfer ? '' : form.subcategory_id,
      payment_method_id: form.payment_method_id,
      notes: form.notes.trim(),
      has_installments: !isEdit && form.type === 'expense' && form.installments > 1,
      installments_total: form.installments,
      transfer_to_account_id: isTransfer ? form.transfer_to_account_id : '',
      is_recurring: !isTransfer && form.installments <= 1 && form.is_recurring,
    }
  }

  async function save(another: boolean) {
    if (!profile || blocker || submitting) return
    setSubmitting(true)
    const data = toFormData()
    try {
      if (transaction) {
        // Pasa por la lógica de cuotas si cambia la cantidad, o si hay que
        // copiar los cambios a todas las cuotas del grupo.
        if (data.type === 'expense' && (form.installments !== origTotal || (origTotal > 1 && applyToAll))) {
          await updateInstallments(transaction, data, form.installments, applyToAll)
        } else {
          await updateTransactionFromForm(transaction.id, data)
        }
        notifySaved('Cambios guardados', data.date, null)
      } else {
        const created = await createTransaction(data, profile.id)
        // Con cuotas la función devuelve el id de la primera; sin cuotas, la fila.
        const undo = typeof created === 'string'
          ? { id: created, group: true }
          : { id: (created as { id: string }).id, group: false }
        notifySaved(SAVED_LABEL[data.type], data.date, undo)
      }
      notifyDataChanged()
      onSuccess?.()

      if (another) {
        // Modo "cargar los tickets del sábado": se mantienen tipo, categoría,
        // cuenta y fecha; se limpia lo que cambia de un ticket a otro.
        const next = { ...form, amount: '', description: '', notes: '', installments: 1, is_recurring: false }
        setForm(next)
        setInitial(next)
        setCustomInstallments(false)
        setSavedTick(true)
        setTimeout(() => setSavedTick(false), 900)
      } else {
        onClose()
      }
    } catch (e: any) {
      toast.error(e.message || 'No se pudo guardar. Probá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  // Aviso de guardado: si cae fuera del mes que se está mirando, ofrece ir a
  // ese mes; si es nuevo, ofrece deshacer.
  function notifySaved(what: string, date: string, undo: { id: string; group: boolean } | null) {
    const outside = monthKey(date) !== viewKey
    if (!outside && !undo) { toast.success(what); return }
    const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7))
    toast.success(t => (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>{what}{outside && <> en {monthName(y, m, selectedMonth.year)}</>}</span>
        {outside && (
          <button
            onClick={() => { setSelectedMonth({ year: y, month: m }); toast.dismiss(t.id) }}
            className="font-semibold underline underline-offset-2 whitespace-nowrap py-1"
          >
            Ver {MESES[m - 1]}
          </button>
        )}
        {undo && (
          <button
            onClick={async () => {
              toast.dismiss(t.id)
              try {
                if (undo.group) await deleteInstallmentGroup(undo.id)
                else await deleteTransaction(undo.id)
                notifyDataChanged()
                toast.success('Listo, no se guardó')
              } catch (e: any) {
                toast.error(e.message || 'No se pudo deshacer')
              }
            }}
            className="font-semibold underline underline-offset-2 whitespace-nowrap py-1"
          >
            Deshacer
          </button>
        )}
      </span>
    ), { duration: 6000 })
  }

  // ---- Piezas de interfaz ----
  const chip = (selected: boolean) =>
    `inline-flex items-center gap-1.5 h-11 px-3.5 rounded-full border text-sm whitespace-nowrap transition-colors select-none ${
      selected
        ? 'bg-brand-soft border-brand text-brand-ink font-medium'
        : 'bg-surface border-line text-ink-700 hover:bg-surface-2 active:bg-surface-2'
    }`
  const label = 'block text-xs font-medium text-ink-500 mb-1.5'
  const textInput = 'w-full h-11 rounded-xl border border-line bg-surface px-3 text-base sm:text-sm text-ink-900 placeholder:text-ink-500 outline-none focus:border-brand'
  const textProps = {
    onFocus: () => setTextFocus(true),
    onBlur: () => setTextFocus(false),
  }

  const extrasSummary = [
    form.description.trim() && `“${form.description.trim()}”`,
    form.installments > 1 && `${form.installments} cuotas`,
    form.is_recurring && 'fijo',
    activePayments.find(p => p.id === form.payment_method_id)?.name,
    form.notes.trim() && 'con nota',
  ].filter(Boolean).join(' · ')

  const typeSwitch = (
    <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-surface-2 border border-line" role="radiogroup" aria-label="Tipo de movimiento">
      {(['expense', 'income', 'transfer'] as const).map(t => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={form.type === t}
          onClick={() => setType(t)}
          className={`h-10 rounded-lg text-sm font-medium transition-colors ${
            form.type === t ? 'bg-surface text-ink-900 shadow-[0_1px_2px_rgb(26_22_16/0.08)]' : 'text-ink-500'
          }`}
        >
          {TYPE_LABEL[t]}
        </button>
      ))}
    </div>
  )

  const footer = confirmDiscard ? (
    <div className="py-1" role="alertdialog" aria-label="Descartar cambios">
      <p className="text-sm font-medium text-ink-900">¿Descartar {isEdit ? 'los cambios' : 'este movimiento'}?</p>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <button type="button" onClick={() => setConfirmDiscard(false)}
          className="h-12 rounded-xl border border-line text-sm font-medium text-ink-900">
          Seguir editando
        </button>
        <button type="button" onClick={onClose}
          className="h-12 rounded-xl bg-neg text-white text-sm font-medium">
          Descartar
        </button>
      </div>
    </div>
  ) : (
    <div className="space-y-2">
      {isMobile && !textFocus && activeAccounts.length > 0 && (
        <Keypad
          onDigit={pressDigit}
          onBackspace={() => set('amount', form.amount.slice(0, -1).replace(/\.$/, ''))}
          onClear={() => set('amount', '')}
        />
      )}
      <div className="flex gap-2">
        {!isEdit && (
          <button
            type="button"
            onClick={() => save(true)}
            disabled={!!blocker || submitting}
            className="h-12 px-3 rounded-xl border border-line text-sm font-medium text-ink-700 disabled:opacity-50 whitespace-nowrap"
          >
            Guardar y otro
          </button>
        )}
        <button
          type="submit"
          form="quick-add-form"
          disabled={!!blocker || submitting}
          className="flex-1 h-12 rounded-xl bg-brand text-white text-sm font-semibold disabled:bg-surface-2 disabled:text-ink-500 disabled:border disabled:border-line"
        >
          {submitting ? 'Guardando…'
            : blocker ? blocker
            : isEdit ? 'Guardar cambios'
            : `${SAVE_LABEL[form.type]} · $ ${formatAmount(form.amount)}`}
        </button>
      </div>
    </div>
  )

  return (
    <Sheet
      open={open}
      title={isEdit ? 'Editar movimiento' : 'Nuevo movimiento'}
      onRequestClose={requestClose}
      header={typeSwitch}
      footer={activeAccounts.length > 0 ? footer : undefined}
      initialFocus={isMobile ? undefined : amountInputRef}
    >
      {activeAccounts.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm font-medium text-ink-900">Primero creá una cuenta</p>
          <p className="text-sm text-ink-500 mt-1">Cada movimiento sale de una cuenta: efectivo, banco, billetera…</p>
          <Link href="/cuentas" onClick={onClose}
            className="inline-flex items-center h-11 mt-5 px-5 rounded-xl bg-brand text-white text-sm font-medium">
            Ir a Cuentas
          </Link>
        </div>
      ) : (
        <form id="quick-add-form" onSubmit={e => { e.preventDefault(); save(false) }} className="pb-4 space-y-4">

          {/* Monto */}
          <div className="text-center pt-1">
            {isMobile ? (
              <output aria-live="polite" aria-label="Monto" className="block num text-[34px] leading-tight font-semibold text-ink-900">
                <span className="text-ink-500 font-normal mr-1">$</span>
                {form.amount ? formatAmount(form.amount) : <span className="text-ink-500">0</span>}
              </output>
            ) : (
              <label className="flex items-baseline justify-center gap-1">
                <span className="sr-only">Monto</span>
                <span className="text-[28px] text-ink-500">$</span>
                <input
                  ref={amountInputRef}
                  value={formatAmount(form.amount)}
                  onChange={e => set('amount', parseTypedAmount(e.target.value))}
                  inputMode="decimal"
                  placeholder="0"
                  // El ancho sigue al número, así el "$" queda pegado.
                  style={{ width: `${Math.max(1, formatAmount(form.amount).length) + 0.5}ch` }}
                  className="num max-w-[300px] text-[34px] leading-tight font-semibold text-ink-900 bg-transparent outline-none placeholder:text-ink-500"
                />
              </label>
            )}
            <p className={`text-xs mt-0.5 min-h-[18px] ${savedTick ? 'text-pos font-medium' : form.type !== 'transfer' && !catName ? 'text-warn' : 'text-ink-500'}`}>
              {savedTick
                ? <span className="inline-flex items-center gap-1"><Check size={14} /> Guardado. Cargá el siguiente</span>
                : form.type === 'transfer'
                  ? `${accountName || '…'} → ${toName || 'elegí destino'}`
                  : [subName ? `${catName} · ${subName}` : catName || 'Sin categoría', accountName].filter(Boolean).join(' · ')}
            </p>
            {form.installments > 1 && amountNum > 0 && (
              <p className="text-xs text-ink-500 num">
                {form.installments} cuotas × $ {formatAmount(form.amount)} = {formatCurrency(amountNum * form.installments)}
              </p>
            )}
          </div>

          {/* Categoría */}
          {form.type !== 'transfer' && (
            <fieldset>
              <legend className={label}>Categoría</legend>
              <div className="flex flex-wrap gap-2">
                {shownCats.map(c => (
                  <button key={c.id} type="button" onClick={() => pickCategory(c.id)}
                    aria-pressed={form.category_id === c.id} className={chip(form.category_id === c.id)}>
                    <span className="w-6 h-6 -ml-1 rounded-full flex items-center justify-center"
                      style={{ background: `${c.color || '#888780'}1F`, color: c.color || '#888780' }}>
                      <CategoryIcon name={c.icon} size={14} />
                    </span>
                    {c.name}
                  </button>
                ))}
                {rootCats.length > TOP && (
                  <button type="button" onClick={() => setAllCats(!allCats)} className={chip(false)} aria-expanded={allCats}>
                    {allCats ? 'Menos' : `Más (${rootCats.length - TOP})`}
                  </button>
                )}
              </div>
              {subcats.length > 0 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar mt-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap" aria-label="Subcategoría (opcional)">
                  {subcats.map(s => (
                    <button key={s.id} type="button"
                      onClick={() => set('subcategory_id', form.subcategory_id === s.id ? '' : s.id)}
                      aria-pressed={form.subcategory_id === s.id} className={chip(form.subcategory_id === s.id)}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </fieldset>
          )}

          {/* Fecha */}
          <fieldset>
            <legend className={label}>Fecha</legend>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
              {dateChips.map(c => (
                <button key={c.iso} type="button" onClick={() => { set('date', c.iso); setPickDate(false) }}
                  aria-pressed={form.date === c.iso} className={chip(form.date === c.iso)}>
                  {c.label}
                </button>
              ))}
              <button type="button" onClick={() => setPickDate(true)}
                aria-pressed={customDate} className={chip(customDate)}>
                {customDate ? shortDay(form.date) : 'Otra fecha'}
                <ChevronDown size={14} />
              </button>
            </div>
            {(pickDate || customDate) && (
              <input type="date" value={form.date} onChange={e => e.target.value && set('date', e.target.value)}
                aria-label="Elegir fecha" className={`${textInput} mt-2`} {...textProps} />
            )}
            {outsideView && (
              <p className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn" role="status">
                {isEdit ? 'Se va a mover a ' : 'Se va a guardar en '}
                <b>{monthName(dateYear, dateMonth, selectedMonth.year)}</b>
                {' · '}estás viendo {monthName(selectedMonth.year, selectedMonth.month, dateYear)}
              </p>
            )}
          </fieldset>

          {/* Cuenta (con una sola cuenta no hay nada que elegir) */}
          {(activeAccounts.length > 1 || form.type === 'transfer') && (
            <fieldset>
              <legend className={label}>{form.type === 'transfer' ? 'Desde' : 'Cuenta'}</legend>
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
                {rankedAccounts.map(a => (
                  <button key={a.id} type="button" onClick={() => setAccount(a.id)}
                    aria-pressed={form.account_id === a.id} className={chip(form.account_id === a.id)}>
                    {a.name}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {form.type === 'transfer' && (
            <fieldset>
              <legend className={label}>Hacia</legend>
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
                {rankedAccounts.filter(a => a.id !== form.account_id).map(a => (
                  <button key={a.id} type="button" onClick={() => set('transfer_to_account_id', a.id)}
                    aria-pressed={form.transfer_to_account_id === a.id} className={chip(form.transfer_to_account_id === a.id)}>
                    {a.name}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {/* Más opciones */}
          <div className="rounded-xl border border-line">
            <button type="button" onClick={() => setMoreOpen(!moreOpen)} aria-expanded={moreOpen}
              className="w-full min-h-[48px] flex items-center justify-between gap-3 px-3 py-2 text-left">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink-900">
                  Descripción{form.type === 'expense' ? ', cuotas' : ''}{form.type !== 'transfer' ? ', fijo' : ''} y más
                </span>
                {!moreOpen && extrasSummary && (
                  <span className="block text-xs text-ink-500 truncate">{extrasSummary}</span>
                )}
              </span>
              <ChevronDown size={18} className={`flex-shrink-0 text-ink-500 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </button>

            {moreOpen && (
              <div className="px-3 pb-3 space-y-4 border-t border-line pt-3">
                <div className="relative">
                  <label htmlFor="qa-desc" className={label}>Descripción (opcional)</label>
                  <input
                    id="qa-desc"
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                    onFocus={() => { setTextFocus(true); setDescFocus(true) }}
                    onBlur={() => { setTextFocus(false); setTimeout(() => setDescFocus(false), 150) }}
                    placeholder={catName ? `Si la dejás vacía: ${subName || catName}` : 'Ej: Carrefour, alquiler…'}
                    autoComplete="off"
                    className={textInput}
                  />
                  {suggestions.length > 0 && (
                    <ul className="mt-1 rounded-xl border border-line bg-surface overflow-hidden" role="listbox" aria-label="Descripciones usadas antes">
                      {suggestions.map(s => (
                        <li key={s.text}>
                          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => applySuggestion(s)}
                            className="w-full min-h-[44px] flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surface-2 active:bg-surface-2 border-b border-line last:border-0">
                            <span className="min-w-0">
                              <span className="block text-sm text-ink-900 truncate">{s.text}</span>
                              <span className="block text-xs text-ink-500 truncate">
                                {categories.find(c => c.id === s.category_id)?.name || 'Sin categoría'}
                                {' · '}{activeAccounts.find(a => a.id === s.account_id)?.name}
                              </span>
                            </span>
                            <span className="num text-sm text-ink-700 flex-shrink-0">{formatCurrency(s.amount)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {activePayments.length > 0 && (
                  <fieldset>
                    <legend className={label}>Medio de pago</legend>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
                      {activePayments.map(p => (
                        <button key={p.id} type="button"
                          onClick={() => { paymentTouched.current = true; set('payment_method_id', form.payment_method_id === p.id ? '' : p.id) }}
                          aria-pressed={form.payment_method_id === p.id} className={chip(form.payment_method_id === p.id)}>
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}

                {/* Cuotas al crear */}
                {form.type === 'expense' && !isEdit && (
                  <fieldset>
                    <legend className={label}>Cuotas (el monto es el de cada cuota)</legend>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
                      <button type="button" onClick={() => { set('installments', 1); setCustomInstallments(false) }}
                        aria-pressed={form.installments === 1 && !customInstallments} className={chip(form.installments === 1 && !customInstallments)}>
                        Sin cuotas
                      </button>
                      {INSTALLMENT_CHIPS.map(n => (
                        <button key={n} type="button" onClick={() => { set('installments', n); setCustomInstallments(false) }}
                          aria-pressed={form.installments === n && !customInstallments} className={chip(form.installments === n && !customInstallments)}>
                          {n}
                        </button>
                      ))}
                      <button type="button" onClick={() => setCustomInstallments(true)}
                        aria-pressed={customInstallments} className={chip(customInstallments)}>
                        Otra
                      </button>
                    </div>
                    {customInstallments && (
                      <input type="number" inputMode="numeric" min={2} max={120}
                        value={form.installments > 1 ? form.installments : ''}
                        onChange={e => set('installments', Math.min(120, Math.max(1, parseInt(e.target.value) || 1)))}
                        placeholder="Cantidad de cuotas" aria-label="Cantidad de cuotas"
                        className={`${textInput} mt-2`} {...textProps} />
                    )}
                    {form.installments > 24 && (
                      <p className="text-xs text-warn mt-1.5">Se van a crear {form.installments} movimientos, uno por mes.</p>
                    )}
                  </fieldset>
                )}

                {/* Cuotas al editar: cambiar la cantidad y a qué cuotas aplicar. */}
                {isEdit && form.type === 'expense' && (
                  <div className="rounded-xl bg-surface-2 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="qa-edit-installments" className="text-sm text-ink-700">
                        Cantidad de cuotas
                        {origTotal > 1 && (
                          <span className="block text-xs text-ink-500">Estás editando la cuota {editingNumber} de {origTotal}</span>
                        )}
                      </label>
                      <input id="qa-edit-installments" type="number" inputMode="numeric" min={editingNumber} max={120}
                        value={form.installments}
                        onChange={e => set('installments', Math.min(120, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-20 h-11 rounded-lg border border-line bg-surface px-3 text-right text-base sm:text-sm outline-none focus:border-brand"
                        {...textProps} />
                    </div>
                    {origTotal > 1 && (
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" checked={applyToAll} onChange={e => setApplyToAll(e.target.checked)} className="mt-1 w-4 h-4 accent-[var(--brand)]" />
                        <span className="text-sm text-ink-700">
                          Aplicar los cambios a todas las cuotas
                          <span className="block text-xs text-ink-500">
                            {applyToAll ? 'Monto, descripción, cuenta, categoría y fechas se copian a todas.' : 'Solo cambia esta cuota.'}
                          </span>
                        </span>
                      </label>
                    )}
                    {form.installments !== origTotal && form.installments >= editingNumber && (
                      <p className="text-xs text-pos font-medium">
                        {form.installments > origTotal
                          ? `Se ${form.installments - origTotal === 1 ? 'agrega 1 cuota' : `agregan ${form.installments - origTotal} cuotas`}, una por mes.`
                          : `Se ${origTotal - form.installments === 1 ? 'borra la última cuota' : `borran las últimas ${origTotal - form.installments} cuotas`}.`}
                      </p>
                    )}
                  </div>
                )}

                {form.type !== 'transfer' && form.installments <= 1 && (
                  <label className="flex items-center justify-between gap-3 cursor-pointer min-h-[44px]">
                    <span className="text-sm text-ink-900">
                      {form.type === 'expense' ? 'Gasto fijo' : 'Ingreso fijo'}
                      <span className="block text-xs text-ink-500">Se repite todos los meses (expensas, luz, sueldo…)</span>
                    </span>
                    <input type="checkbox" role="switch" checked={form.is_recurring}
                      onChange={e => set('is_recurring', e.target.checked)}
                      className="w-5 h-5 flex-shrink-0 accent-[var(--brand)]" />
                  </label>
                )}

                <div>
                  <label htmlFor="qa-notes" className={label}>Notas</label>
                  <textarea id="qa-notes" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-base sm:text-sm text-ink-900 outline-none focus:border-brand resize-none"
                    {...textProps} />
                </div>
              </div>
            )}
          </div>
        </form>
      )}
    </Sheet>
  )
}
