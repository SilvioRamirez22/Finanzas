import { redirect } from 'next/navigation'

// Histórico se reemplazó por Seguimiento (docs/ux/07-SEGUIMIENTO.md).
// Queda la redirección para accesos guardados y enlaces viejos.
export default function HistoricoPage() {
  redirect('/seguimiento')
}
