import { Repeat } from 'lucide-react'

// Cartel "Fijo" para los gastos que se repiten todos los meses
// (expensas, luz, internet...). Se guarda en transactions.is_recurring.
export default function RecurringBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title="Gasto fijo: se repite todos los meses"
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-medium flex-shrink-0 ${className}`}
    >
      <Repeat size={10} /> Fijo
    </span>
  )
}
