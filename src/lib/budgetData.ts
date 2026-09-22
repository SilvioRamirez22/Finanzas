import { getBudgets, getMonthPlans, getTransactionsLite } from './api'
import { firstDay, lastDay, shift } from './budget'

// Lo que usan Presupuesto y el editor del plan, en tres consultas: los
// presupuestos, los planes y 10 meses de movimientos (el mes, 5 para el
// historial y 3 más para los promedios de cada uno).
export async function loadBudgetData(year: number, month: number) {
  const from = shift(year, month, -9)
  const [budgets, plans, txs] = await Promise.all([
    getBudgets(),
    getMonthPlans(),
    getTransactionsLite(firstDay(from.year, from.month), lastDay(year, month)),
  ])
  return { budgets, plans, txs }
}
