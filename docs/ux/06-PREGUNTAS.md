# Preguntas para no iterar al vuelo

> **Respondidas el 2026-09-17.** El resumen de decisiones está abajo; el cuestionario original
> queda como referencia de por qué se eligió cada cosa.

## Decisiones tomadas

| # | Tema | Decisión |
|---|---|---|
| 1 | Modelo de presupuesto | **Plan del mes** (ingreso − ahorro = disponible; se descuenta lo comprometido; aparece "sin asignar") |
| 2 | Presupuesto por mes | **Sí**, independiente y con historial (intervalos sobre `budgets`) |
| 3 | Sobrante al mes siguiente | **No** por ahora; columna `rollover` preparada |
| 4 | Fijos y cuotas separados de lo variable | **Sí** |
| 5 | Nivel del presupuesto | **Solo categoría raíz** |
| 6 | Ahorro objetivo | **Sí**, en pesos, con chips de 10 % / 20 % |
| 7 | Orden de las filas | **Por riesgo** (excedidas → adelantadas → resto) |
| 8 | Teclado numérico propio | **Sí** |
| 9 | Medio de pago | **Se carga** (chips en "Más opciones") |
| 10 | Descripción | **Opcional**, con autocompletado del historial |
| 11 | "Guardar y cargar otro" | Sí |
| 13 | Cargar los fijos del mes con un toque | **Sí** (no recurrencia automática: se confirman) |
| 14 | Cuotas | El monto que se ingresa es el de **cada cuota** → se arregla la función SQL |
| 15 | Cuotas futuras y saldo | **Saldo = solo confirmado** + línea "comprometido a futuro" |
| 16 | Monedas | **USD aparte, sin convertir**; el total en pesos nunca las suma |
| 17 | Ajuste por inflación | **No por ahora** |
| 12 | Tarjeta de crédito con ciclo | **Sí, fase 2** |
| 19 | Modo oscuro | **Sí, sigue al sistema** + override manual |
| 20 | Densidad | **Compacta en listas, aireada en tarjetas de resumen** |
| 21 | Color en gráficos | **Verde y rojo** (ver la nota de abajo) |
| 22 | Íconos y atajo del PWA | **Sí**, se arreglan |
| — | Ingreso esperado del plan | Por defecto **promedio de 3 meses**, editable |
| — | Borrar | **Deshacer de 5 s**, sin `confirm()`; para cuotas, hoja con dos opciones |
| 26 | Orden de trabajo | **Etapa 1 primero** ("que no mienta"), después flujo de carga y presupuesto |

### Nota sobre el verde y el rojo en gráficos

El par que usa hoy la app (`#0F6B4F` / `#B0402B`) **falla** la separación para protanopía
(ΔE 5,7 medido). Manteniendo la convención verde/rojo, el par que sí pasa las cinco
comprobaciones en modo claro es:

- ingresos **`#15803D`** · gastos **`#DC2626`** → ΔE 8,6 (deutan), contraste ≥ 3:1, croma OK.

En **modo oscuro** no existe un par verde/rojo que cumpla a la vez la banda de luminosidad y la
separación por daltonismo: el mejor es `#127F42` / `#FB8168` (ΔE 11,0, contraste OK, apenas más
claro de lo ideal sobre fondo oscuro). Por eso, en los gráficos van además **etiquetas directas
de valor y trama diagonal en la serie de gastos**: el gráfico se lee igual sin color.

Pendientes de tu lado: la URL de producción (23) y, si querés que levante la app localmente,
el `.env.local` (24) y la verificación SQL de 2 minutos (25).

---

## Cuestionario original

Podés contestar en una sola línea (`1B, 2A, 3 sí, …`). **Cada pregunta tiene un valor por
defecto**: si no contestás, arranco con la recomendación marcada y lo dejo anotado.

---

## A. Presupuesto (lo que define el módulo entero)

**1. Modelo.** ¿Topes por categoría, o plan que arranca de tus ingresos?
- A) Solo topes por categoría, por mes.
- **B) Plan del mes (recomendado):** ingreso esperado − ahorro objetivo = disponible; se
  descuenta lo comprometido (fijos + cuotas) y el resto se reparte en topes. Aparece el número
  "sin asignar".
- C) Sobres estilo YNAB, con sobrante que pasa al mes siguiente.

**2. ¿El presupuesto de cada mes es independiente?** (editar octubre sin tocar septiembre, y
guardar historia).
→ **Recomendado: sí.** Es el arreglo de D4 y no requiere tabla nueva.

**3. ¿El sobrante de una categoría pasa al mes siguiente?**
→ **Recomendado: no** por ahora (columna preparada para activarlo después).

**4. ¿Separo "comprometido" (fijos + cuotas) de lo variable?**
→ **Recomendado: sí.** Hoy "te queda $200.000" puede ser falso si $180.000 son cuotas.

**5. ¿Presupuesto por subcategoría?** (ej. tope propio para "Delivery" dentro de Alimentación)
→ **Recomendado: no**, tope en la categoría raíz y detalle por subcategoría adentro.

**6. ¿Querés objetivo de ahorro explícito?** (y si sí, ¿en pesos o en % del ingreso?)
→ **Recomendado: sí, en pesos, con chips de 10 % / 20 % para calcularlo rápido.**

**7. ¿Cómo querés ordenar las categorías en la pantalla?**
- A) Por desvío (lo de hoy).
- **B) Por riesgo (recomendado):** excedidas → adelantadas respecto del ritmo → resto por monto.
- C) Alfabético / manual.

---

## B. Cargar movimientos

**8. Teclado numérico propio en el sheet** (en vez del teclado del sistema): resuelve el zoom de
iOS, el salto de layout y el botón inalcanzable.
→ **Recomendado: sí.**

**9. Medio de pago** (Efectivo / Débito / Crédito / MP / Transferencia): hoy la tabla existe, se
seedea y **nunca se carga**.
- A) Lo cargamos (chips en "Más opciones") y habilitamos "¿cuánto pagué con crédito?".
- B) Lo borramos del modelo.
→ **Recomendado: A**, sobre todo si querés el resumen de tarjeta (pregunta 12).

**10. Descripción obligatoria.** Hoy zod la exige. Con categoría en chips, la descripción pasa a
ser opcional y con autocompletado del historial.
→ **Recomendado: opcional.**

**11. ¿Querés "Guardar y cargar otro"** (cargar 8 tickets sin cerrar el sheet)?
→ **Recomendado: sí.**

**12. Tarjeta de crédito con ciclo de cierre** (`closing_day`/`due_day` ya están en la base y no
se usan): pantalla "lo que cierra el 25", con cuotas incluidas.
→ **Recomendado: sí, fase 2.**

**13. Generar los gastos fijos del mes con un toque** (crea los movimientos con el monto del mes
anterior, para que los ajustes): hoy solo se detectan por texto y se listan como "faltan
cargar".
→ **Recomendado: sí** — es la tarea más repetitiva de la app.

---

## C. Plata, monedas y tiempo

**14. Cuotas: ¿el monto que ingresás es el de cada cuota o el total de la compra?**
Hoy el copy dice "cada cuota" y el SQL lo divide (bug D1).
→ **Recomendado: monto por cuota** (es como viene el resumen de la tarjeta). Si preferís total,
también sirve: cambia el copy y se muestra "= $X por mes".

**15. Las cuotas futuras, ¿deben restar del saldo hoy?**
Hoy una compra en 12 cuotas descuenta las 12 del saldo en el momento.
- A) Dejar como está.
- **B) Recomendado:** saldo = solo lo confirmado, y una línea aparte "comprometido a futuro:
  $X".

**16. ¿Tenés o vas a tener cuentas en USD?** Hoy el total suma monedas distintas como si fueran
pesos (D6).
- A) No → totalizo solo ARS y listo.
- B) Sí, mostrar por separado sin convertir.
- C) Sí, con conversión (necesito decidir la fuente del tipo de cambio: MEP, oficial, manual).
→ **Recomendado: B ahora**, C cuando digas.

**17. ¿Querés ajuste por inflación en el histórico?** ("ver en pesos de hoy"). Es lo que hace
que comparar 2025 con 2026 signifique algo.
- Índice: IPC (mensual, se publica con rezago) / CER (diario) / dólar MEP.
→ **Recomendado: sí, con CER** (diario, sin rezago) y toggle nominal ↔ real. Decime si preferís
IPC.

**18. Centavos.** Hoy la pantalla redondea al peso y la base guarda 2 decimales.
→ **Recomendado: dejarlo así** (redondeo solo al mostrar).

---

## D. Interfaz

**19. Modo oscuro.** Con los tokens del punto 1 de `02-DESIGN-SYSTEM.md` sale casi gratis.
→ **Recomendado: sí, y que siga al sistema** (con override manual en Configuración).

**20. Densidad.** ¿Preferís la app más compacta (más filas por pantalla, tipo planilla) o más
aireada?
→ **Recomendado: compacta en listas, aireada en las tarjetas de resumen** (es lo que ya hace,
solo hay que unificarlo).

**21. ¿Mantengo el verde como color de marca?** Sí en toda la interfaz. Ojo: **en los gráficos**
propongo ingreso = azul y gasto = terracota, porque el par verde/rojo no lo distingue quien
tiene daltonismo (ΔE 5,7 medido, ver `04-GLOBAL-DASHBOARD.md` §3.2).
→ **Recomendado: aceptar el cambio solo en gráficos.**

**22. ¿Instalada como app en el teléfono?** Si la usás así, los íconos del PWA están rotos
(`icon-192.png` y `icon-512.png` no existen, F5) y el atajo "Nuevo gasto" no hace nada.
→ **Recomendado: los genero y hago funcionar el atajo.**

---

## E. Cosas que necesito de vos (no son decisiones)

**23. ¿Cuál es la URL de producción?** No hay `.vercel/` en el repo (el deploy sale por la
integración de GitHub) y no quiero adivinar el dominio.

**24. Para poder correr la app localmente** hace falta `.env.local` con
`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **No me las pegues en el chat**:
creá el archivo vos (o decime que lo dejo pedido y trabajo sin levantar la app, como hice para
esta auditoría).

**25. Verificación de 2 minutos en Supabase → SQL Editor.** Tres cosas que el repo no me deja
confirmar:

```sql
-- (a) ¿qué firma tienen realmente las funciones? (hallazgo D2)
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_month_summary','get_expenses_by_category',
                    'get_monthly_evolution','create_installments');

-- (b) ¿create_installments divide el monto? (hallazgo D1)
select pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.proname='create_installments';

-- (c) ¿hay presupuestos duplicados o con fechas raras? (hallazgo D4)
select category_id, count(*), min(start_date), max(start_date),
       count(*) filter (where end_date is not null) as con_fin
from budgets where is_active group by category_id having count(*) > 1;
```

Con el resultado de (a) y (b) confirmo o descarto D1/D2 sin tocar nada.

---

## F. Prioridad

**26. ¿Con qué arranco?** Mi orden (detalle en `00-RESUMEN.md`):
1. Que la pantalla se actualice al cargar un movimiento (A1) + estados de carga/error.
2. Cuotas y firmas SQL (D1, D2) — antes de construir presupuesto sobre datos torcidos.
3. Tokens + foco + contraste + toques (X1, X2, X3, V1): una pasada, toda la app.
4. Flujo de carga nuevo (teclado + chips).
5. Presupuesto fase 0 y 1.
6. El resto.

Si preferís ver primero el presupuesto funcionando y después la limpieza, se puede: solo hay que
hacer la Fase 0 de `05` igual, porque el módulo se apoya en eso.
