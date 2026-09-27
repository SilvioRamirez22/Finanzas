import { ArrowLeftRight } from 'lucide-react'
import CategoryIcon, { isEmojiIcon } from '@/components/CategoryIcon'

// Cuadradito redondeado con el emoji (o el ícono) de una categoría sobre su
// color suave. Sin categoría: gris; una transferencia: flechas.
export default function CategoryTile({ icon, color, size = 40, transfer = false, className = '' }: {
  icon?: string | null
  color?: string | null
  size?: number
  transfer?: boolean
  className?: string
}) {
  const c = color || '#888780'
  const style = {
    width: size, height: size,
    borderRadius: Math.round(size * 0.32),
    background: transfer ? 'var(--muted)' : `${c}2E`,
    color: isEmojiIcon(icon) ? undefined : c,
  }
  return (
    <span aria-hidden="true" style={style}
      className={`flex-shrink-0 inline-flex items-center justify-center ${transfer ? 'text-ink-700' : ''} ${className}`}>
      {transfer
        ? <ArrowLeftRight size={Math.round(size * 0.45)} />
        : <CategoryIcon name={icon || 'tag'} size={Math.round(size * 0.5)} />}
    </span>
  )
}
