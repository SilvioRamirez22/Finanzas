'use client'
import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'

// Hoja de abajo en el celular, modal centrado en escritorio.
// Cumple el contrato de un diálogo: Escape cierra, el foco queda adentro,
// el fondo no scrollea y al cerrar el foco vuelve a donde estaba.
//
// onRequestClose se llama con Escape, la X o tocando el fondo. Si hay algo
// escrito, el que usa la hoja decide si pregunta antes de cerrar.
export default function Sheet({ open, title, onRequestClose, header, footer, children, initialFocus }: {
  open: boolean
  title: string
  onRequestClose: () => void
  // Contenido fijo arriba (debajo del título), por ejemplo el selector de tipo.
  header?: React.ReactNode
  // Contenido fijo abajo, siempre a mano del pulgar.
  footer?: React.ReactNode
  children: React.ReactNode
  initialFocus?: React.RefObject<HTMLElement>
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onRequestClose)
  closeRef.current = onRequestClose

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // En el celular no enfocamos un campo de texto: abriría el teclado del
    // sistema encima de la hoja. Enfocamos el panel, que no abre nada.
    const t = setTimeout(() => (initialFocus?.current ?? panelRef.current)?.focus(), 30)

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => closeRef.current()} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative bg-surface w-full sm:max-w-[520px] rounded-t-[20px] sm:rounded-2xl max-h-[94dvh] sm:max-h-[90dvh] flex flex-col shadow-[0_-8px_30px_rgb(0_0_0/0.18)] outline-none animate-sheet-up"
      >
        <div className="sm:hidden flex justify-center pt-2.5 pb-1" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-ink-300" />
        </div>
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-1 sm:pt-4 pb-2">
          <h2 id={titleId} className="text-base font-semibold text-ink-900">{title}</h2>
          <button
            type="button"
            onClick={() => closeRef.current()}
            aria-label="Cerrar"
            className="w-11 h-11 -mr-2.5 flex items-center justify-center rounded-full text-ink-500 hover:bg-surface-2 active:bg-surface-2"
          >
            <X size={20} />
          </button>
        </div>
        {header && <div className="px-4 sm:px-5 pb-2">{header}</div>}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5">
          {children}
        </div>
        {footer && (
          <div className="border-t border-line px-4 sm:px-5 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
