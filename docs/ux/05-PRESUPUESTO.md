# Presupuesto — diseño completo del módulo

Es lo que falta construir. Hoy `/presupuestos` existe como pantalla pero el modelo de datos no
soporta la idea de "presupuesto de un mes", y dos de los tres números que muestra están mal
calculados (D3, D4 en la auditoría).

Este documento define: el modelo mental, el modelo de datos, el SQL, las pantallas, los
estados, el copy y las fases. Las decisiones que necesitan tu confirmación están marcadas con
**[decidir]** y tienen mi recomendación; con eso se puede empezar sin esperar.

---

## 1. Qué hay hoy y por qué no alcanza

Funciona:
- Tabla `budgets` con monto por categoría, RLS y join a categoría.
- Pantalla con % global, filas por categoría ordenadas por desvío, barra con marca de 100 %,
  bloque "sin presupuesto" y sugerencias aplicables con un toque (esa idea es muy buena y se
  mantiene).

No funciona:
1. **No hay noción de mes** (D4): un presupuesto por categoría, para siempre. Editar en octubre
   cambia el pasado. No se puede planificar enero distinto de diciembre.
2. **El cumplimiento histórico está mal** (D3): compara *todo* el gasto del mes contra el
   presupuesto *de hoy* de las categorías presupuestadas.
3. **6 consultas encadenadas** de hasta 5.000 filas para 6 barritas (P4).
4. El presupuesto no sabe nada de lo que ya está comprometido: gastos fijos y cuotas del mes
   entran como cualquier gasto variable, entonces "te quedan $200.000" es mentira si $180.000
   son cuotas que ya vencen.
5. No hay presupuesto total, ni ingreso esperado, ni objetivo de ahorro: no se puede responder
   "¿cuánto puedo gastar este mes sin comerme el ahorro?".
6. El editor es una lista de inputs numéricos sin contexto: no dice cuánto gastaste en promedio,
   ni cuánto te queda por asignar.

---

## 2. Modelo mental propuesto

**[decidir]** Tres opciones, de menor a mayor ambición:

| | Qué es | Pro | Contra |
|---|---|---|---|
| **A. Topes por categoría** (lo de hoy, arreglado por mes) | Un monto máximo por categoría y mes | Simple, ya casi está | No dice si el plan cierra con tus ingresos |
| **B. Plan del mes** (recomendado) | Ingreso esperado − ahorro objetivo = disponible; se reparte entre comprometido (fijos + cuotas) y topes por categoría; queda "sin asignar" | Responde "¿cuánto puedo gastar?" y cierra la cuenta. Usa datos que ya tenés (fijos, cuotas, promedios) | Un poco más de UI: una pantalla de armado |
| **C. Sobre por categoría estilo YNAB** | Cada peso se asigna a un sobre y los sobrantes pasan al mes siguiente | Muy potente | Obliga a asignar todo, todos los meses; alto mantenimiento |

**Recomiendo B.** Es el que aprovecha lo que la app ya sabe (fijos marcados, cuotas futuras,
promedio de 3 meses) y el que convierte el presupuesto de "lista de topes" en "plan que cierra".
C se puede habilitar después con un flag por categoría (`rollover`), sin romper nada.

### La ecuación que muestra la pantalla

```
Ingreso esperado del mes            2.100.000     (editable; sugerido = promedio 3 meses)
− Ahorro objetivo                    −300.000     (editable; opcional)
─────────────────────────────────────────────
  Disponible para gastar            1.800.000
    ya comprometido
      fijos del mes                   620.000     (suma de is_recurring)
      cuotas que vencen este mes      180.000     (installment_number del mes)
    presupuestado variable            850.000     (suma de topes por categoría)
─────────────────────────────────────────────
  Sin asignar                         150.000     ← el número que hace click
```

Con eso, la tarjeta del dashboard puede decir algo verdadero: *"te quedan $150.000 sin asignar"*
o *"te pasaste $80.000 del plan antes de empezar el mes"*.

---

## 3. Modelo de datos

### 3.1 Presupuesto vigente por intervalo (sin tabla nueva)

`budgets` ya tiene `start_date`, `end_date`, `is_active` y `UNIQUE(user_id, category_id,
start_date)`. Alcanza; lo que falta es **usarlos**:

- Una fila = "desde este mes, el tope de esta categoría es X".
- `end_date NULL` = sigue vigente.
- El monto aplicable a un mes M es el de la fila con **el `start_date` más grande** entre las
  que cubren M.
- Editar desde M en adelante: se cierra la fila anterior (`end_date` = último día de M−1) y se
  inserta una nueva con `start_date` = primer día de M.
- Cambiar **solo** un mes (vacaciones, aguinaldo): fila con `start_date` = 1° de M y `end_date`
  = último día de M. Gana en M por tener el `start_date` más grande, y en M+1 vuelve a regir la
  anterior.
- Dejar de presupuestar una categoría: `end_date` = último día de M−1 (no `is_active = false`:
  eso borraría la historia).

Migración: **ninguna**. Verificado el 2026-09-17: la tabla `budgets` está **vacía** en
producción. Todo lo de arriba se estrena en limpio, y el asistente de primera vez (§5.3) deja de
ser un caso borde — es la pantalla que vas a ver la primera vez que entres.

### 3.2 Plan mensual (tabla nueva, chica)

Para el ingreso esperado y el objetivo de ahorro:

```sql
create table month_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  expected_income numeric(14,2),
  savings_target  numeric(14,2) default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year, month)
);
alter table month_plans enable row level security;
create policy "user_own_month_plans" on month_plans for all using (user_id = auth.uid());
```

Sin fila = plan no armado (la pantalla ofrece armarlo con valores sugeridos).

### 3.3 Campo opcional para el futuro

`alter table budgets add column rollover boolean not null default false;`
Preparado para el modo sobre (opción C) sin usarlo todavía.

---

## 4. Consultas (una RPC por pantalla, no 6 en serie)

### 4.1 Estado del presupuesto de un mes

```sql
create or replace function get_budget_status(p_year int, p_month int)
returns table (
  category_id uuid, category_name text, category_color text, category_icon text,
  budget numeric,            -- tope vigente para ese mes (0 si no hay)
  spent numeric,             -- gasto total de la categoría en el mes
  spent_fixed numeric,       -- de eso, gastos marcados como fijos
  spent_installments numeric,-- de eso, cuotas
  tx_count int
) language sql security definer stable as $$
  with bounds as (
    select make_date(p_year, p_month, 1) as d0,
           (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date as d1
  ),
  vigente as (   -- una fila por categoría: el presupuesto que rige en el mes
    select distinct on (b.category_id) b.category_id, b.amount
    from budgets b, bounds
    where b.user_id = auth.uid() and b.is_active
      and b.start_date <= bounds.d1
      and (b.end_date is null or b.end_date >= bounds.d0)
    order by b.category_id, b.start_date desc
  )
  select c.id, c.name, c.color, c.icon,
         coalesce(v.amount, 0),
         coalesce(sum(t.amount), 0),
         coalesce(sum(t.amount) filter (where t.is_recurring), 0),
         coalesce(sum(t.amount) filter (where t.installments_total > 1), 0),
         count(t.id)::int
  from categories c
  cross join bounds
  left join vigente v on v.category_id = c.id
  left join transactions t
         on t.category_id = c.id and t.user_id = auth.uid()
        and t.type = 'expense' and t.status <> 'cancelled'
        and t.date between bounds.d0 and bounds.d1
  where c.user_id = auth.uid() and c.parent_id is null and c.type in ('expense','both')
  group by c.id, c.name, c.color, c.icon, v.amount
  order by coalesce(v.amount,0) desc, coalesce(sum(t.amount),0) desc;
$$;
```

Notas:
- `security definer` + `auth.uid()`: el cliente no manda `user_id` (consistente con lo que ya
  corre en producción; ver D2).
- Incluye categorías sin presupuesto y sin gasto: la UI decide si las muestra.
- El gasto de subcategorías queda contado en la categoría raíz solo si el movimiento guarda la
  raíz en `category_id` (que es lo que hace el formulario hoy: la lista solo ofrece raíces).

### 4.2 Historial de cumplimiento correcto (reemplaza el bucle de 6 consultas)

```sql
create or replace function get_budget_history(p_months int default 6)
returns table (year int, month int, budgeted numeric, spent_on_budgeted numeric, over_count int)
```
Para cada mes: presupuesto **vigente en ese mes** y gasto **solo de las categorías
presupuestadas en ese mes**. Una sola ida y vuelta.

### 4.3 Escritura

```sql
-- set_budget(categoria, monto, desde_anio, desde_mes, modo)
--   modo 'desde_ahora' -> cierra la fila anterior e inserta desde ese mes
--   modo 'solo_mes'    -> override de un mes
--   monto 0            -> deja de presupuestar desde ese mes
```
Una sola función evita que la app tenga que razonar sobre intervalos (hoy `upsertBudget` se
llama desde tres lugares distintos con semánticas distintas).

---

## 5. Pantallas

### 5.1 `/presupuesto` — vista del mes

Tres bloques, en este orden (móvil):

**(a) Encabezado "Plan de septiembre"**

```
┌────────────────────────────────────────────┐
│ PLAN DE SEPTIEMBRE            [ Editar ]   │
│                                            │
│ Gastaste $842.000 de $1.650.000            │
│ ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░  51%   ┊día 17      │
│                          ↑ marca de ritmo  │
│ Vas bien: al día 17 deberías ir en 57%     │
│                                            │
│ Te queda $808.000 para 13 días → $62.000/día│
├────────────────────────────────────────────┤
│ fijos         620.000  ████████ 100% ✓     │
│ cuotas        180.000  ████████ 100% ✓     │
│ variable      850.000  ▓▓▓░░░░░  5%        │
└────────────────────────────────────────────┘
```

- El número grande es **lo gastado contra el plan**, no el porcentaje: el porcentaje es el
  apoyo, no el protagonista (hoy el héroe es "51 %", que no dice cuánta plata es).
- La marca de ritmo (día del mes) es lo que convierte la barra en algo accionable.
- Fijos y cuotas se muestran aparte porque **no se gestionan**: se pagan. Mezclarlos con lo
  variable es lo que hace que "te queda X" sea falso.

**(b) Por categoría** (se mantiene la estructura actual, mejorada)

```
Alimentación      ▓▓▓▓▓▓▓▓░░ 78%   $234.000 / $300.000    $66.000 libres
  promedio 3 meses $287.000 · 42 movimientos
Ocio              ▓▓▓▓▓▓▓▓▓▓ 124%  $62.000 / $50.000      +$12.000 ⚠ excedido
Transporte        ▓▓▓░░░░░░░ 31%   $46.500 / $150.000     $103.500 libres · vas lento
```

- Orden **[decidir]**: hoy es por % de desvío. Recomiendo por *riesgo*: excedidas primero,
  después las que van adelantadas respecto del ritmo, después el resto por monto.
- Cada fila expande a los movimientos de la categoría (reusar `CategoryDetail` del dashboard).
- Tocar el monto abre el editor de esa categoría directamente (hoy hay que abrir el modal con
  todas).
- Fila "Sin presupuesto" con el total y acción "presupuestar" por categoría (ya existe el
  bloque; se le suma la acción).

**(c) Cumplimiento** (arreglado, D3)

6 barras = % del presupuesto **de cada mes** usado ese mes, con línea de 100 %, y la frase
"Cerraste dentro del plan 4 de los últimos 6 meses" calculada con los datos correctos.

### 5.2 `/presupuesto/editar` — armar el plan (pantalla, no modal)

El editor actual es un modal con una lista de inputs. Para un plan de 10-15 categorías, en
celular, conviene pantalla completa con encabezado fijo:

```
┌────────────────────────────────────────────┐
│ ← Armar el plan de octubre          Listo  │
├────────────────────────────────────────────┤
│ Ingreso esperado       $ 2.100.000   [ ]   │  ← sugerido: promedio 3 meses
│ Ahorro objetivo        $   300.000   [ ]   │
│ Fijos + cuotas (calculado)  $800.000       │
│                                            │
│  SIN ASIGNAR            $ 150.000          │  ← sticky arriba mientras editás
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░                       │
├────────────────────────────────────────────┤
│ Copiar de septiembre │ Sugerir por promedio│  ← dos atajos de un toque
├────────────────────────────────────────────┤
│ 🛒 Alimentación   prom. $287k   [ 300.000 ]│
│ 🚗 Transporte     prom. $141k   [ 150.000 ]│
│ 🍔 Delivery       prom.  $68k   [  50.000 ]│
│ …                                          │
├────────────────────────────────────────────┤
│  Aplicar desde octubre  ▾                  │  ← octubre en adelante / solo octubre
│  [ Guardar el plan ]                       │
└────────────────────────────────────────────┘
```

- El contador "sin asignar" se actualiza en vivo y cambia de color si queda negativo
  ("te pasaste del disponible por $80.000") — sin bloquear: es tu plata.
- Cada input usa el teclado propio (`Keypad` de `03`), con `.num` y separadores.
- "Copiar de septiembre" y "Sugerir por promedio" son los dos caminos que evitan la hoja en
  blanco.
- El selector "aplicar desde" es lo que hace que el modelo por intervalos se entienda sin
  explicarlo.
- Guardado por lote: **una** llamada, no un `for` con `await` por categoría (hoy
  `EditBudgets.save()` hace N requests secuenciales y si una falla queda a medias).

### 5.3 Primera vez (hoy: un párrafo gris)

Asistente de 3 pasos, con valores ya calculados:

1. "¿Cuánto esperás que entre en octubre?" → sugerido = promedio de ingresos de 3 meses.
2. "¿Cuánto querés ahorrar?" → chips 10 % / 20 % / otro.
3. "Estos son tus promedios: te propongo estos topes" → lista editable + "Ya está".

Al terminar: se crea el `month_plan` y los `budgets` de un saque, y se cae en la vista del mes
con el plan armado.

### 5.4 En el dashboard

La tarjeta de presupuesto pasa a mostrar el plan, no tres barras sueltas:

```
Presupuesto de septiembre                    Ver
$842.000 de $1.650.000 · 51%   ┊ día 17
▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░
2 categorías excedidas · te queda $808.000
```

Y las alertas del presupuesto se suman a la tarjeta "Atención" de `04`.

---

## 6. Estados y copy

| Situación | Qué se muestra |
|---|---|
| Sin plan ni presupuestos | Tarjeta con "Armá tu plan de octubre en 1 minuto" + botón. Nada de "Sin presupuestos definidos" en gris |
| Plan armado, mes recién empezado | "Recién arranca el mes: $1.650.000 disponibles para 30 días" |
| Mes en curso, dentro del ritmo | "Vas bien: al día 17 deberías ir en 57 % y vas en 51 %" |
| Adelantado | "Vas $61.000 arriba del ritmo. Si seguís así cerrás en $1.840.000 (+11 %)" |
| Excedido | "Te pasaste $80.000. Las categorías: Ocio +$12.000, Delivery +$68.000" |
| Mes cerrado (pasado) | "Cerraste en $1.720.000: $70.000 arriba del plan" + comparación con el promedio |
| Mes futuro | "Ya hay $800.000 comprometidos (fijos + cuotas)" + botón para armar el plan |
| Categoría sin gasto | barra vacía, sin `0 %` rojo; texto "sin gastos todavía" |
| Cargando | skeleton de 3 filas + barra |
| Error | "No pudimos traer el presupuesto" + Reintentar |

Tono: segunda persona, sin signos de exclamación, sin culpa. "Te pasaste $80.000" es
información; "¡Cuidado! 😱" es ruido.

---

## 7. Decisiones (cerradas el 2026-09-17)

| # | Decisión | Resuelto |
|---|---|---|
| 1 | Modelo A / B / C | **B — plan del mes** |
| 2 | ¿Presupuesto por mes con historial? | **Sí** (intervalos, sin tabla nueva) |
| 3 | ¿El sobrante pasa al mes siguiente? | **No** por ahora; la columna `rollover` se crea igual |
| 4 | ¿Separar fijos y cuotas de lo variable? | **Sí** |
| 5 | ¿Presupuestar subcategorías? | **No**: tope en la raíz, detalle por sub adentro |
| 6 | ¿Presupuestar ingresos? | **No**: solo ingreso esperado + ahorro objetivo (en pesos) |
| 7 | Orden de las filas | **Por riesgo** (excedidas → adelantadas → resto) |
| 8 | Ingreso esperado por defecto | **Promedio de 3 meses**, editable |
| 9 | ¿Gastos anuales (seguro, patente)? | Fase 3: "fondo mensual" que amortiza en 12 |
| 10 | ¿Alertas? | Fase 1 en la app; push, más adelante |
| 11 | ¿Presupuesto en USD? | No: el plan es en pesos; las cuentas en USD van aparte (D6) |

---

## 8. Criterios de aceptación

1. Editar el presupuesto de octubre **no cambia** ningún número de septiembre.
2. Un presupuesto puesto en marzo sigue vigente en abril sin volver a cargarlo.
3. El override de un mes no afecta al siguiente.
4. "Te queda $X" no incluye fijos ni cuotas ya comprometidos.
5. La pantalla se arma con **2 consultas** como máximo (estado + historial).
6. El historial de cumplimiento usa el presupuesto vigente de cada mes y solo las categorías
   presupuestadas.
7. Con 0 presupuestos, la pantalla ofrece un camino de 3 pasos y ≤ 1 minuto.
8. Todo se puede operar con el pulgar en un teléfono de 360 px, sin scroll horizontal.

---

## 9. Fases

**Fase 0 — arreglos previos (bloquean todo lo demás)**
- D4: `start_date`/`end_date` en uso + `set_budget` + migración de las filas actuales.
- D3: `get_budget_status` y `get_budget_history` (mata también P4).
- D1: definir la semántica de cuotas (el presupuesto las necesita bien para separar
  "comprometido").

**Fase 1 — presupuesto por mes usable**
- Vista del mes con plan, ritmo y por categoría.
- Editor a pantalla completa con "sin asignar", copiar mes anterior y sugerir por promedio.
- `month_plans` (ingreso esperado + ahorro objetivo).
- Tarjeta del dashboard y alertas en "Atención".

**Fase 2 — plan que cierra**
- Asistente de primera vez.
- Fijos y cuotas comprometidos, con la acción "cargar los fijos del mes" (F3).
- Historial de cumplimiento con comparación contra promedios.

**Fase 3 — opcional**
- `rollover` por categoría (modo sobre).
- Fondo mensual para gastos anuales.
- Notificaciones push al 80/100 %.
- Presupuesto en términos reales (ajustado por inflación, F6).
