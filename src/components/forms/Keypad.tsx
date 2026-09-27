'use client'
import { useRef } from 'react'
import { Check, Delete } from 'lucide-react'

// Teclado numérico propio para el monto. En el celular reemplaza al del
// sistema: no tapa la hoja, tiene "000" y no hace zoom en iOS.
//
// Con `submit`, la última tecla es el ✓ de guardar (el borrar va al lado del
// monto, con <BackspaceButton>); sin él, la última tecla es ⌫.
export default function Keypad({ onDigit, onBackspace, onClear, submit }: {
  onDigit: (d: string) => void
  onBackspace?: () => void
  onClear?: () => void
  submit?: { label: string; disabled: boolean; form: string }
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0']
  const keyClass =
    'h-[52px] rounded-2xl bg-surface-2 text-[22px] text-ink-900 num ' +
    'active:bg-muted active:scale-[.98] transition-transform select-none touch-manipulation'

  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Teclado numérico">
      {keys.map(k => (
        <button key={k} type="button" className={keyClass} onClick={() => onDigit(k)}>
          {k}
        </button>
      ))}
      {submit ? (
        <button
          type="submit"
          form={submit.form}
          aria-label={submit.label}
          disabled={submit.disabled}
          className="h-[52px] rounded-2xl bg-brand text-white flex items-center justify-center active:bg-brand-hover disabled:bg-muted disabled:text-ink-500 transition-colors touch-manipulation"
        >
          <Check size={26} strokeWidth={2.6} />
        </button>
      ) : (
        <BackspaceButton onBackspace={onBackspace!} onClear={onClear!} className={`${keyClass} flex items-center justify-center`} />
      )}
    </div>
  )
}

// ⌫: borra un número; mantenerlo apretado borra todo.
export function BackspaceButton({ onBackspace, onClear, className }: {
  onBackspace: () => void
  onClear: () => void
  className: string
}) {
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cleared = useRef(false)
  function startHold() {
    cleared.current = false
    hold.current = setTimeout(() => { cleared.current = true; onClear() }, 500)
  }
  function endHold() {
    if (hold.current) clearTimeout(hold.current)
    hold.current = null
  }
  return (
    <button
      type="button"
      aria-label="Borrar (mantener para borrar todo)"
      className={className}
      onPointerDown={startHold}
      onPointerUp={endHold}
      onPointerLeave={endHold}
      onClick={() => { if (!cleared.current) onBackspace() }}
    >
      <Delete size={22} />
    </button>
  )
}
