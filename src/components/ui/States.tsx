'use client'
import { AlertCircle, RotateCw } from 'lucide-react'

// Barra gris que ocupa el lugar de un texto mientras carga.
export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`rounded bg-muted animate-pulse ${className}`} />
}

// Tarjeta en blanco con la forma de la que va a aparecer, para que la pantalla
// no salte cuando llegan los datos.
export function CardSkeleton({ lines = 3, big = false }: { lines?: number; big?: boolean }) {
  return (
    <div className="bg-surface rounded-2xl border border-line p-4 md:p-5" aria-hidden="true">
      <SkeletonLine className="h-3 w-28" />
      {big && <SkeletonLine className="h-9 w-48 mt-3" />}
      <div className="space-y-3 mt-4">
        {Array.from({ length: lines }, (_, i) => (
          <SkeletonLine key={i} className={`h-4 ${i % 3 === 2 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </div>
  )
}

// No se pudo cargar. `compact`: ya hay datos en pantalla y fallo la
// actualizacion; se avisa arriba sin tapar lo que se ve.
export function ErrorState({ onRetry, compact = false }: { onRetry: () => void; compact?: boolean }) {
  if (compact) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 bg-warn-soft border border-line rounded-xl px-4 py-2.5 text-sm">
        <span className="text-warn">No se pudo actualizar. Lo que ves puede estar desactualizado.</span>
        <button onClick={onRetry} className="flex-shrink-0 font-medium text-warn underline underline-offset-2 py-1">
          Reintentar
        </button>
      </div>
    )
  }
  return (
    <div role="alert" className="bg-surface rounded-2xl border border-line px-6 py-10 text-center">
      <AlertCircle size={28} className="mx-auto text-ink-500" />
      <p className="text-sm font-medium text-ink-900 mt-3">No se pudieron cargar los datos</p>
      <p className="text-sm text-ink-500 mt-1">Revisá la conexión y probá de nuevo.</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 mt-5 bg-brand hover:bg-brand-hover text-white rounded-xl px-5 py-2.5 text-sm font-medium"
      >
        <RotateCw size={15} /> Reintentar
      </button>
    </div>
  )
}
