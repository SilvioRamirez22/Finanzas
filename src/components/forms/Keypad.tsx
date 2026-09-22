'use client'
import { useRef } from 'react'
import { Delete } from 'lucide-react'

// Teclado numérico propio para el monto. En el celular reemplaza al del
// sistema: no tapa la hoja, tiene "000" y no hace zoom en iOS.
// Mantener apretado ⌫ borra todo.
export default function Keypad({ onDigit, onBackspace, onClear }: {
  onDigit: (d: string) => void
  onBackspace: () => void
  onClear: () => void
}) {
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cleared = useRef(false)

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0']
  const keyClass =
    'h-12 rounded-xl bg-surface-2 border border-line text-xl font-medium text-ink-900 num ' +
    'active:bg-line active:scale-[.98] transition-transform select-none touch-manipulation'

  function startHold() {
    cleared.current = false
    hold.current = setTimeout(() => { cleared.current = true; onClear() }, 500)
  }
  function endHold() {
    if (hold.current) clearTimeout(hold.current)
    hold.current = null
  }

  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Teclado numérico">
      {keys.map(k => (
        <button key={k} type="button" className={keyClass} onClick={() => onDigit(k)}>
          {k}
        </button>
      ))}
      <button
        type="button"
        aria-label="Borrar (mantener para borrar todo)"
        className={`${keyClass} flex items-center justify-center`}
        onPointerDown={startHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onClick={() => { if (!cleared.current) onBackspace() }}
      >
        <Delete size={22} />
      </button>
    </div>
  )
}
