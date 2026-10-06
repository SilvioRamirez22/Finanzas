// Fechas de las cuotas (cálculos puros). Las usa updateInstallments al guardar
// y la carga para mostrar cuándo vence cada cuota antes de guardar, así lo que
// se ve es lo que se graba.

const pad2 = (n: number) => String(n).padStart(2, '0')

// Suma meses a "YYYY-MM-DD" igual que Postgres con INTERVAL '1 month':
// si el día no existe en el mes destino (31 de febrero), usa el último.
export function addMonthsISO(iso: string, months: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const last = new Date(ny, nm, 0).getDate()
  return `${ny}-${pad2(nm)}-${pad2(Math.min(d, last))}`
}

// Las fechas que pone create_installments: la primera el día de la compra y
// después una por mes, siempre contando desde la primera.
export function installmentDates(start: string, total: number) {
  return Array.from({ length: Math.max(1, total) }, (_, i) => addMonthsISO(start, i))
}

export interface InstallmentRowDate {
  id: string
  installment_number: number
  date: string
}

// Al editar una cuota: la fecha que le queda a cada cuota 1..newTotal.
// rows: las cuotas que ya existen en la base (o solo el movimiento, si todavía
// no tenía cuotas). Si no se tocó la fecha, cada cuota conserva la suya y las
// nuevas siguen a la primera: recalcular desde la cuota editada correría fechas
// ya ajustadas a fin de mes (una compra del 31 tiene cuotas el 28 o el 30).
export function planInstallmentDates(
  rows: InstallmentRowDate[],
  edited: InstallmentRowDate & { installments_total: number },
  formDate: string, newTotal: number, applyToAll: boolean,
) {
  const k = edited.installments_total > 1 ? edited.installment_number : 1
  const byNumber = new Map(rows.map(r => [r.installment_number, r]))
  const parent = byNumber.get(1) || edited
  const dateUnchanged = formDate === edited.date
  const dates: string[] = []
  for (let i = 1; i <= newTotal; i++) {
    const row = byNumber.get(i)
    const fromForm = applyToAll || !row || row.id === edited.id
    dates.push(row && (dateUnchanged || !fromForm)
      ? row.date
      : dateUnchanged ? addMonthsISO(parent.date, i - 1) : addMonthsISO(formDate, i - k))
  }
  return dates
}
