# Auditoría UX / UI — Finanzas Personales

Revisión completa del código al 2026-09-17 (commit `3d6bd60`). Mirada de diseño de
interfaces: qué rompe el uso real, qué no se puede tocar con el pulgar, qué miente en
pantalla y qué falta. Cada hallazgo tiene severidad, evidencia (`archivo:línea`) y arreglo
propuesto.

Severidades:
- **P0** — rompe el uso o muestra datos incorrectos. Se arregla antes de seguir construyendo.
- **P1** — fricción alta o barrera de accesibilidad real.
- **P2** — pulido, consistencia, deuda de diseño.

Índice: [A] flujo roto · [D] datos y correctitud · [X] accesibilidad · [V] sistema visual
· [P] performance y estados · [F] faltantes.

---

## A — Flujo roto (lo que más duele)

### A1 · P0 — Cargás un movimiento y la pantalla no se actualiza
`src/components/layout/AppProvider.tsx:96` · `src/app/dashboard/page.tsx:50`

El modal global (`quickAddOpen`) vive en `AppProvider`, y al guardar solo hace
`getAccounts()` + `setAccounts()`. El dashboard y `/movimientos` cargan sus datos en un
`useState` propio que depende de `[year, month]`, así que **después de cargar un gasto desde
el botón "+" no cambia nada en pantalla**: ni el resultado del mes, ni las categorías, ni la
lista del día. Solo se mueve el saldo de la tarjeta "Saldo total".

La persona carga el gasto, ve el toast "Gasto registrado", mira la pantalla, no ve su gasto y
lo vuelve a cargar. Es el bug de UX más caro de la app.

**Arreglo:** un solo origen de verdad para los movimientos del mes. Opciones, de menor a
mayor obra:
1. Un `refreshKey` en el store que `AppProvider` incrementa al guardar y del que dependan los
   `useCallback` de cada página (5 líneas).
2. Mover los movimientos del mes al store (`transactionsByMonth`) con invalidación al
   guardar / editar / borrar.
3. TanStack Query con `invalidateQueries(['tx', year, month])` — lo correcto si la app va a
   seguir creciendo: trae caché, refetch al volver del background y estados de carga gratis.

Recomiendo (2) ahora y (3) cuando aparezca la tercera pantalla que consuma lo mismo.

### A2 · P0 — El mes que estás mirando y la fecha del movimiento no se hablan
`src/components/layout/MonthNav.tsx` · `src/components/forms/QuickAddModal.tsx:69`

El mes es contexto global (header), pero el formulario siempre nace con `date: todayISO()`.
Si estás revisando agosto y cargás algo, se guarda en septiembre y **desaparece de la vista**
sin explicación (agravado por A1: ni siquiera se recarga).

**Arreglo:** si `selectedMonth ≠ mes actual`, el formulario avisa arriba del botón guardar:
"Se va a guardar en **septiembre** (estás viendo agosto)", con acción "Usar 31 de agosto". Y
al guardar, si el movimiento cae fuera del mes visible, el toast lleva "Ver septiembre".

### A3 · P1 — Elegir cuenta y categoría cuesta 6 toques en `<select>` nativos
`src/components/forms/QuickAddModal.tsx:239-282`

`Cuenta` arranca en "Elegir..." y es obligatoria: **cada carga** son 3 toques (abrir el picker
nativo, scrollear, confirmar). Categoría, otros 3. Con 3 cuentas y ~10 categorías, un
`<select>` es el control equivocado: no hay memoria de la última usada ni orden por
frecuencia.

**Arreglo:** cuenta = fila de chips con la última usada preseleccionada (persistida en
`localStorage`); categoría = grilla de chips ordenada por uso de los últimos 90 días + "Más…"
para el resto. Detalle en `03-FLUJO-MOVIMIENTO.md`.

### A4 · P1 — Categoría opcional que rompe los reportes en silencio
`src/components/forms/QuickAddModal.tsx:261` ("Sin categoría") · `get_expenses_by_category`
agrupa por categoría

Un gasto sin categoría entra en el total de "Gastos" pero **no aparece en ningún lado del
desglose**: la suma de "Gastos por categoría" queda por debajo del total del mes y no hay fila
que explique la diferencia. Ninguna pantalla muestra "Sin categoría".

**Arreglo:** (a) fila explícita "Sin categoría" en el desglose, con acción "categorizar" que
abre la lista de esos movimientos; (b) en el formulario, la categoría se sugiere sola por
descripción y queda a un toque, pero se permite guardar sin ella.

### A5 · P1 — `confirm()` del navegador para borrar, y doble para cuotas
`src/app/movimientos/page.tsx:104-110` · `cuentas/page.tsx:54` · `categorias/page.tsx:47`

Dos diálogos nativos encadenados ("¿Eliminar?" y después "¿Todas las cuotas?") para una acción
reversible. En PWA instalada el `confirm()` nativo se ve como error del sistema, no como parte
de la app, y no hay deshacer.

**Arreglo:** borrado optimista + toast con **Deshacer** (5 s) para el caso simple. Para cuotas,
una hoja con dos botones explícitos: "Solo esta cuota (3/12)" / "Las 12 cuotas".

### A6 · P1 — El modal no es un modal
`src/components/forms/QuickAddModal.tsx:150-153`

Falta todo el contrato de diálogo: no hay `role="dialog"` ni `aria-modal`, no hay foco
atrapado, **Escape no cierra**, el scroll del fondo no se bloquea (el sheet de "Más" sí lo hace:
`AppLayout.tsx:44-50`) y el clic en el backdrop cierra y **descarta lo tipeado sin preguntar**.

**Arreglo:** un componente `Sheet` único y reutilizable (lo van a usar el alta, la edición, el
editor de presupuesto y las cuentas): `role="dialog"`, `aria-modal`, foco inicial, trampa de
foco, Escape, bloqueo de scroll, y backdrop que pide confirmación solo si el formulario está
sucio (`formState.isDirty`).

### A7 · P1 — Con el teclado abierto, "Guardar" queda abajo del teclado
`src/components/forms/QuickAddModal.tsx:153` (`max-h-[95vh] overflow-y-auto`)

El sheet mide 95 vh y scrollea entero, botón incluido. En un teléfono con teclado numérico
abierto el área visible baja a ~45 vh: hay que cerrar el teclado para poder guardar.

**Arreglo:** footer sticky con el botón primario (`position: sticky; bottom: 0` + `pb-safe`)
y, mejor todavía, teclado numérico propio dentro del sheet (ver `03`): el teclado del sistema
nunca aparece y el layout no salta.

### A8 · P2 — Dos instancias del mismo formulario
`src/components/layout/AppProvider.tsx:137` y `src/app/movimientos/page.tsx:281`

`/movimientos` monta su propio `QuickAddModal` para editar mientras el global sigue montado
para crear. Funciona, pero hay dos fuentes de callbacks (`onSuccess` distintos) y es
exactamente el origen de A1.

**Arreglo:** un solo modal en el provider, manejado por el store: `openTransactionSheet(tx?)`.

### A9 · P2 — El menú "Más" de escritorio abre solo con hover
`src/components/layout/AppLayout.tsx` (menú con `group-hover:visible`)

Sin foco de teclado ni click. En notebook con pantalla táctil, no abre.

**Arreglo:** botón con estado (`aria-expanded`) + cierre por Escape y click afuera.

### A10 · P2 — El selector de mes es el control más usado y el más chico
`src/components/layout/MonthNav.tsx:41-63`

En celular: etiqueta de 58 px y flechas `‹ ›` de ~32×36 px, arriba a la derecha, compitiendo
con el título. Es el control que define **todo** lo que ves.

**Arreglo:** barra de mes propia, ancho completo, debajo del header: `‹ septiembre 2026 ›` con
botones de 44 px, swipe horizontal para cambiar de mes y tap en el nombre para abrir el
selector de mes/año. Ver `04-GLOBAL-DASHBOARD.md`.

---

## D — Datos y correctitud (verificar contra la base de producción)

> El SQL del repo puede estar desfasado de lo que corre en Supabase. Dos de estos hallazgos
> dependen de eso; en `06-PREGUNTAS.md` está el chequeo de 2 minutos para confirmarlos.

### D1 · P0 — Las cuotas se guardan divididas: el monto que ingresás no es el que queda
`src/lib/api.ts:50-67` · `create_installments` en `sql/INSTALAR_TODO.sql`

El formulario dice literalmente "Este es el valor de **cada cuota**" y muestra
"12 cuotas de $10.000 = $120.000 total" (`QuickAddModal.tsx:208-212, 384-388`). Después manda
ese número como `p_total_amount`, y la función SQL hace
`v_installment_amount := ROUND(p_total_amount / p_installments, 2)`.

Resultado: cargás 12 cuotas de $10.000 y quedan **12 cuotas de $833,33**. El camino de edición
(`updateInstallments`, `api.ts:140-200`) sí trata el monto como valor por cuota, así que crear
y editar el mismo gasto dan resultados distintos.

**Arreglo:** elegir una semántica (recomiendo *monto por cuota*, que es como llega el resumen
de la tarjeta) y alinear los tres lugares: copy, `createTransaction` y la función SQL. Si se
elige *total*, el copy pasa a "Total de la compra" y hay que mostrar "= $X por mes".

### D2 · P0 — Firmas de las funciones SQL: el repo pide `p_user_id`, la app no lo manda
`src/lib/api.ts:220-243` vs `get_month_summary` / `get_expenses_by_category` /
`get_monthly_evolution` en `sql/INSTALAR_TODO.sql`

En el repo las tres funciones reciben `p_user_id UUID` como primer parámetro; la app las llama
solo con fechas. Si en Supabase estuviera la versión del repo, el dashboard tiraría `PGRST202`
y, como `load()` no tiene `catch` (`dashboard/page.tsx:52-88`), la excepción quedaría como
*unhandled rejection*: categorías vacías y **ningún mensaje de error en pantalla**. Como el
dashboard funciona, en producción hay otra versión (con `auth.uid()`).

**Arreglo:** (a) versionar de verdad las migraciones (`sql/migrations/00X_*.sql`) y que el repo
refleje lo que corre; (b) pase lo que pase, ningún `load()` sin `catch` + estado de error
visible.

### D3 · P0 — El historial de cumplimiento compara peras con manzanas
`src/app/presupuestos/page.tsx:44-58`

El gráfico "Cumplimiento" de 6 meses calcula, para cada mes, **todo el gasto del mes**
(`type: 'expense'`, sin filtrar categoría) contra el **presupuesto total de hoy**. Dos errores
sumados:
- numerador: incluye categorías que nunca tuvieron presupuesto → el % siempre da alto;
- denominador: usa el presupuesto vigente hoy, no el de aquel mes (ver D4).

Hoy ese gráfico dice "te pasaste" casi siempre, y la frase "Cerraste dentro del presupuesto X
de los últimos 6 meses" es, en el mejor caso, ruido.

**Arreglo:** comparar solo el gasto de las categorías presupuestadas contra el presupuesto
vigente de cada mes. Con la RPC `get_budget_status` de `05` sale en una sola consulta.

### D4 · P0 — Los presupuestos no tienen mes: editar hoy reescribe el pasado
`src/lib/api.ts:305-320` · tabla `budgets`

La tabla tiene `start_date` / `end_date` / `period`, pero `getBudgets()` filtra solo por
`is_active` y ninguna pantalla mira esas fechas. `upsertBudget` sin `id` inserta con
`start_date = DATE_TRUNC('month', CURRENT_DATE)`; con `id`, actualiza el monto y deja la fecha
vieja.

En la práctica: **hay un solo presupuesto por categoría, para siempre**. Si en octubre subís
Alimentación de $300.000 a $400.000, septiembre pasa a haber "cumplido" contra $400.000. No hay
forma de planificar un mes distinto (aguinaldo, vacaciones, enero) ni de guardar historia.

**Arreglo:** presupuesto vigente por intervalo (sin tabla nueva) + RPC que resuelve el monto
aplicable a cada mes. Diseño completo en `05-PRESUPUESTO.md`.

### D5 · P1 — Las cuotas futuras ya te bajaron el saldo
`sql/ARREGLO_SALDOS_AL_EDITAR.sql` (el trigger suma todo lo que no está `cancelled`) ·
`create_installments` inserta las cuotas 2..N con `status = 'pending'`

Una compra en 12 cuotas descuenta las 12 del saldo de la cuenta hoy mismo, y las 11 futuras se
cuentan como gasto de sus meses. O sea: el saldo mezcla "lo que tengo" con "lo que voy a
deber". El campo `status` existe para distinguirlo y nadie lo usa: no hay filtro por estado en
ninguna pantalla (`movimientos` filtra tipo, categoría, cuenta y monto; no estado).

**Arreglo:** decidir qué significa el saldo. Recomiendo: saldo = solo `confirmed`, más una
línea aparte "comprometido a futuro (cuotas): $X". El presupuesto usa las cuotas del mes como
gasto comprometido, que es exactamente lo que son.

### D6 · P1 — Se suman monedas distintas
`src/store/useAppStore.ts:60-66` · `src/app/dashboard/page.tsx:152` ·
`src/app/cuentas/page.tsx:60`

`accounts.currency` existe (ARS/USD/EUR/BRL) y el detalle por cuenta lo respeta
(`cuentas/page.tsx:96`), pero **el total suma los números sin convertir** y los muestra como
pesos. Con una caja de ahorro en USD, el "Saldo total" del dashboard queda mal por un factor
~1.000 y no hay ningún aviso.

**Arreglo mínimo hoy:** totalizar solo ARS y mostrar las otras monedas como líneas aparte
("USD 1.200"), nunca sumadas. Multi-moneda con tipo de cambio: ver `06-PREGUNTAS.md`.

### D7 · P1 — Los centavos se pierden en pantalla y eso no se dice
`src/lib/format.ts:10-17` (`maximumFractionDigits: 0`)

Todo se redondea al peso al mostrar (la base guarda `NUMERIC(14,2)`). Sumas de muchos
movimientos con centavos van a mostrar diferencias de $1-2 contra el resumen del banco, y ya
hay un aviso de descuadre en el detalle de categoría (`dashboard/page.tsx:554`) que puede
disparar por esto.

**Arreglo:** redondear al peso está bien para montos grandes; el descuadre y los totales se
calculan siempre con los valores exactos, no con los mostrados (hoy es así: mantenerlo, y
subir el umbral del aviso a $1 por movimiento involucrado).

### D8 · P2 — Los "gastos fijos que faltan" se comparan por texto
`src/app/dashboard/page.tsx:138-150`

El aviso "Faltan cargar (estaban en agosto)" matchea por descripción normalizada. "Edenor" y
"Luz Edenor" son dos gastos distintos para el algoritmo: aparece un falso pendiente y al mes
siguiente otro. Es una heurística inteligente para no tener recurrencias reales, pero conviene
convertirla en la feature de verdad (ver F3).

### D9 · P2 — `is_recurring` es solo una etiqueta
`recurrence_rule` y `recurrence_end_date` existen en el schema y en los tipos, y nunca se
escriben ni se leen.

---

## X — Accesibilidad (transversal: toca casi todos los archivos)

### X1 · P1 — No hay ningún indicador de foco en toda la app
39 usos de `outline-none`, **0** de `focus-visible` / `focus:ring` (grep sobre `src`).

Cada input cambia solo el color del borde al enfocarse (`focus:border-emerald-400`), que de
`#E5E7EB` a `#34D399` no llega a 3:1 de contraste de estado; y los botones no muestran nada.
Navegar con teclado es imposible de seguir. La base del skill lo marca severidad **High**
(WCAG 2.4.7, y 2.4.11 para la apariencia del foco).

**Arreglo (global, 6 líneas en `globals.css`):**
```css
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  border-radius: 6px;
}
```

### X2 · P1 — Texto gris sobre blanco por debajo del mínimo de contraste
`text-gray-400` (#9CA3AF sobre #FFF ≈ **2,6:1**) se usa para *toda* la metadata de 11 px:
fechas, nombres de cuenta, "vs. agosto", ayudas de formulario. `text-gray-300` (≈ **1,9:1**)
para los vacíos ("Sin gastos este mes", `dashboard/page.tsx:248`). El mínimo AA es 4,5:1 (3:1
solo si el texto es ≥ 24 px, o ≥ 19 px en bold).

**Arreglo:** escala de grises nueva con contraste medido (ver `02-DESIGN-SYSTEM.md`): metadata
`--ink-500 #6E6B64` (4,6:1), y `--ink-300` reservado para bordes e íconos decorativos, nunca
para texto.

### X3 · P1 — Objetivos táctiles por debajo de 44 px
- `···` para borrar: `text-sm` + `px-1` ≈ 24×20 px (`movimientos/page.tsx:334, 377`)
- toggle "fijo" (`Repeat size={14}`) ≈ 22×22 px
- flechas del mes en compacto: 32×36 px (`MonthNav.tsx:44`)
- cerrar el modal (`X size={20}` sin padding) ≈ 20×20 px (`QuickAddModal.tsx:161`)

Y están pegados entre sí (borrar y fijo, con ~4 px de separación): en un scroll con el pulgar
se toca "eliminar" queriendo marcar "fijo". La guía es 44×44 px con ≥ 8 px de aire (severidad
**Critical** en la tabla del skill).

**Arreglo:** área táctil de 44 px vía `p-2.5 -m-2.5` (crece el hit area sin mover el diseño), y
las acciones destructivas fuera de la fila: swipe o menú "⋯" que abre una hoja con Editar /
Marcar fijo / Duplicar / Eliminar.

### X4 · P1 — `···` no es un control: es ambiguo y no dice qué hace
`movimientos/page.tsx:334-338, 376-379`

Tiene `aria-label="Eliminar"` (bien) pero visualmente son tres puntos, que en toda interfaz
significan "más opciones", no "borrar". Un toque accidental borra sin deshacer (A5).

**Arreglo:** que `···` sea de verdad "más opciones" (hoja con acciones) y que eliminar viva
adentro, en rojo, con deshacer.

### X5 · P1 — Filas "clickeables" que el teclado no puede usar
`movimientos/page.tsx:302` y `:341` (`<div onClick role="button">` sin `tabIndex` ni
`onKeyDown`)

Editar un movimiento es imposible sin mouse o dedo. Además el `role="button"` en un contenedor
con botones adentro anida controles (el lector de pantalla lee "botón, dentro de botón").

**Arreglo:** la fila es un `<button>` (o un `<div tabIndex={0}>` con `onKeyDown`
Enter/Espacio) y los botones internos salen del área clickeable (columna propia a la derecha).

### X6 · P1 — Editar y borrar cuentas y categorías **no existe en el celular**
`cuentas/page.tsx:106` · `categorias/page.tsx:102, 122`
(`opacity-0 group-hover:opacity-100`, sin variante `md:`)

Los botones de editar y eliminar solo aparecen con hover. En un teléfono no hay hover: la
tarjeta no ofrece ninguna acción. La app es PWA-first (barra inferior, FAB, safe-areas): el
caso principal es justo el que no puede editar.

**Arreglo:** en < 768 px, controles siempre visibles (o fila completa que abre la hoja de
edición). Es el patrón que ya resolvieron bien en `movimientos` con la vista de tarjeta.

### X7 · P2 — Solo `aria-label` en 11 lugares; faltan los estados
No hay `aria-expanded` en el menú "Más" ni en los filtros, no hay `aria-live` para los totales
que cambian al filtrar, ni `role="status"` en "Cargando…". Los `<input>` del editor de
presupuestos no tienen label asociado (`presupuestos/page.tsx:359`): el nombre de la categoría
es un `<p>` al lado, no un `<label for>`.

### X8 · P2 — Sin `prefers-reduced-motion` y sin modo oscuro
`globals.css` define `fadeIn` sin guarda de movimiento reducido, y hay **0** clases `dark:` en
todo el proyecto, con `theme_color` verde y uso nocturno esperable en una app de gastos.

---

## V — Sistema visual (hoy hay tres paletas conviviendo)

### V1 · P1 — Tres paletas sin relación
- **Tailwind**: emerald / red-500 / amber-500 / indigo-50 / blue-500.
- **Hardcodeada en el dashboard**: terracota `#B54A32`, `#C08268`, `#D5D2CB`
  (`dashboard/page.tsx:277`).
- **De la base**: colores por categoría y por cuenta (`#1D9E75`, `#378ADD`, `#D85A30`…, seed
  del SQL), usados como fondo al 25 % (`+ '40'`).

El fondo general es un crudo cálido `#F5F4F0` (`AppLayout.tsx`) que no está en el
`tailwind.config`, y el `theme_color` del manifest es `#059669` (emerald-600) mientras la marca
en pantalla es emerald-700/800. No hay tokens: los colores se deciden en cada archivo.

**Arreglo:** un set de variables CSS (`02-DESIGN-SYSTEM.md`) con roles semánticos (`--pos`,
`--neg`, `--warn`, `--brand`, superficies e ink), `tailwind.config` apuntando a esas variables,
y los colores de la base usados **solo** como identidad de la categoría (punto o barra), nunca
como color de dato.

### V2 · P1 — Rojo para guardar un gasto
`QuickAddModal.tsx:420` — el botón primario del formulario es `bg-red-500` cuando el tipo es
"Gasto".

Rojo es destructivo o error en todo el resto de la interfaz (eliminar, montos negativos,
presupuesto excedido). Acá es la acción más común y deseada de la app. Además el toggle de tipo
ya comunica gasto / ingreso / transferencia con color de fondo: no hace falta repetirlo en el
botón.

**Arreglo:** el primario siempre es la marca; el color del tipo queda en el toggle y en el
signo del monto.

### V3 · P1 — 26 `style={{ fontFamily: 'ui-monospace, …' }}` inline
grep: 26 ocurrencias en 9 archivos. Cada número de la app repite el mismo objeto de estilo, y
el monoespaciado del sistema cambia por plataforma (SF Mono / Consolas / DejaVu): el mismo
monto mide distinto en iPhone, Android y Windows, y no queda alineado en columnas.

**Arreglo:** una clase `.num { font-variant-numeric: tabular-nums; }` sobre Inter (que ya está
cargada y tiene cifras tabulares). Mismo ancho por dígito, sin cambiar de familia, sin 26
estilos inline. Si se quiere un mono real para el número héroe, `JetBrains Mono` en un solo
peso vía `next/font` (+18 KB) y nada más.

### V4 · P2 — Radios, sombras y jerarquías inconsistentes
Tarjetas `rounded-xl border-gray-200` en dashboard / presupuestos / movimientos vs
`rounded-2xl border-gray-100` en cuentas / categorías / inversiones / histórico. `shadow-card`
existe en el config y **no se usa** (grep: 0). Títulos de sección: `text-sm font-semibold
text-gray-900` en unas páginas, `text-sm font-medium text-gray-700` en otras. El `h1` de página
existe en cuentas / histórico / buscar / configuración, y **no existe** en dashboard /
movimientos / presupuestos.

**Arreglo:** dos primitivas (`Card`, `SectionTitle`) y una decisión: el `h1` lo pone el layout a
partir de la ruta, y las páginas solo aportan secciones.

### V5 · P2 — Íconos de Tabler cargados por CDN y sin usar
`globals.css:6` importa `@tabler/icons-webfont` desde jsdelivr (CSS + fuente, render
bloqueante) y la app usa `lucide-react` en todos los componentes. Los `icon` de la base
(`'shopping-cart'`, `'gas-station'`, nombres de Tabler) tampoco se renderizan en ningún lado:
**las categorías tienen ícono en la base y en pantalla se muestran sin ícono**.

**Arreglo:** borrar el `@import` y mapear los nombres de Tabler de la seed a los equivalentes de
lucide en un objeto; así las chips de categoría del formulario nuevo tienen ícono real y el
color de la base cobra sentido.

### V6 · P2 — Números con signo ambiguo
En "Últimos movimientos" los gastos van en rojo con `−` y los ingresos en verde con `+`
(`dashboard/page.tsx:469`), pero en la lista de `/movimientos` los gastos van en
`text-gray-900` con `−` (`movimientos/page.tsx:313`). Misma información, dos codificaciones en
dos pantallas contiguas.

### V7 · P2 — El eje del gráfico muestra montos completos
`historico/page.tsx:77` pasa `formatCurrency(v, 'ARS', true)` esperando formato compacto, pero
`format.ts:13` **ignora a propósito** el parámetro `compact`. El eje Y termina con "$2.400.000"
en 10 px: las etiquetas se superponen o se recortan.

**Arreglo:** `formatCompact()` aparte (`$2,4 M`, `$350 k`) para ejes y chips; el monto completo
se reserva para los valores que la persona tiene que leer exacto.

---

## P — Performance y estados

### P1 · P1 — `loading` se calcula y nunca se usa
`dashboard/page.tsx:48` y `presupuestos/page.tsx:31`: `setLoading(true/false)` sin un solo
`{loading && …}` en el JSX (grep confirmado).

Al cambiar de mes, la pantalla **sigue mostrando los números del mes anterior** como si fueran
los nuevos, durante 1-3 s en 4G. No hay forma de saber que está cargando; en una app de plata,
mostrar datos viejos sin marcarlos es peor que mostrar un esqueleto.

**Arreglo:** skeleton por tarjeta (con alto reservado, para que no haya CLS) y, cuando hay datos
previos, atenuarlos con `aria-busy="true"`.

### P2 · P1 — Sin estado de error en ninguna pantalla
`dashboard` y `presupuestos` usan `try/finally` sin `catch`; `movimientos` igual. Si Supabase
responde 401/500 (token vencido al volver del background, que en esta app pasó y está
documentado en `AppProvider`), la pantalla queda **vacía y silenciosa**.

**Arreglo:** estado de error con causa y botón "Reintentar" por tarjeta, más un `ErrorBoundary`
de ruta.

### P3 · P1 — El dashboard baja hasta 10.000 movimientos para mostrar 8 números
`dashboard/page.tsx:57-62`: dos `getTransactions(..., 5000, 0)` (mes actual y anterior) más dos
RPC. Del mes anterior solo se usan dos sumas y las descripciones de los fijos. Y existe
`get_month_summary` en la API (`api.ts:220`) que **ninguna pantalla llama**.

**Arreglo:** totales por RPC; los movimientos del mes se bajan una vez (los necesita el detalle
por categoría) y se comparten vía store (A1). Del mes anterior, una RPC nueva que devuelva solo
los fijos.

### P4 · P1 — Presupuestos hace 6 consultas encadenadas de hasta 5.000 filas
`presupuestos/page.tsx:47-58`: un `for` con `await` adentro, un mes por iteración. En 4G son ~6
idas y vueltas en serie para dibujar 6 barritas, y se repite cada vez que cambiás de mes.

**Arreglo:** una RPC `get_budget_history(p_months)` (definida en `05-PRESUPUESTO.md`) o, como
mínimo, `Promise.all`.

### P5 · P2 — `ignoreBuildErrors: true` + `ignoreDuringBuilds: true`
`next.config.js:4-9`: los errores de TypeScript y ESLint no frenan el deploy. Con
`updateInstallments` haciendo `row!.description` y `resolver: zodResolver(schema) as any`
(`QuickAddModal.tsx:66`), hay lugares donde el tipo ya no protege nada y el error va a aparecer
en producción, no en el build.

**Arreglo:** ponerlos en `false` y arreglar lo que salte.

### P6 · P2 — Código muerto que confunde la lectura
- `src/components/layout/PeriodSelector.tsx` (123 líneas, un selector de período completo):
  **nunca importado**.
- `selectedCats` en `historico/page.tsx:25`: estado que no se usa.
- `sidebarOpen` en el store: no lo lee nadie.
- `payment_methods`: tabla + seed + `getPaymentMethods()` + campo en el schema de zod… y
  **ningún input** que lo cargue (ver F1).
- `month_snapshots`, `investment_transactions`: tablas sin uso en la app.
- `README.md` promete Realtime, offline y sidebar: nada de eso existe hoy (`SWCleanup.tsx`
  justamente **desregistra** el service worker).

---

## F — Faltantes (features que la estructura ya pide)

### F1 · P1 — Medio de pago: se pide en la base, no se carga nunca
`payment_methods` tiene seed (Efectivo, Débito, Crédito, Mercado Pago, Transferencia),
`transactions.payment_method_id` existe, `TransactionFormData` lo declara, zod lo valida… y el
formulario no lo muestra. No se puede responder "¿cuánto pagué con crédito este mes?", que es
la pregunta natural antes de que cierre la tarjeta.

Decisión binaria: se carga (una fila de chips en "Más opciones") o se borra del modelo.

### F2 · P1 — Tarjeta de crédito sin ciclo
`accounts.closing_day` y `due_day` existen y no se usan. Con cuotas + fijos + medio de pago, la
app tiene todo para mostrar "Resumen de la tarjeta que cierra el 25: $X, de los cuales $Y son
cuotas". Hoy la tarjeta es una cuenta más con saldo negativo.

### F3 · P1 — Los gastos fijos no se generan: se detectan por texto
La heurística del dashboard (D8) es un buen parche. La feature real: un toque "Cargar los 6
fijos de septiembre" que crea los movimientos con el monto del mes anterior, en estado "a
confirmar", y te deja ajustar los que cambiaron (luz, expensas). Es la tarea mensual más
repetitiva de la app.

### F4 · P2 — Sin deshacer, sin duplicar, sin carga en lote
Tres cosas que una app de gastos usa todos los días: deshacer (A5), duplicar un movimiento
frecuente, y "guardar y cargar otro" sin cerrar el sheet (el sábado se cargan 8 tickets
juntos).

### F5 · P2 — Los atajos del PWA y la instalación están rotos
- `public/manifest.json` apunta a `/icon-192.png` y `/icon-512.png`: **ninguno de los dos
  archivos existe** en `public/` (solo están `manifest.json` y `sw.js`). El ícono de "Agregar a
  inicio" queda en blanco o con una captura de la pantalla.
- El shortcut "Nuevo gasto" abre `/dashboard?quick=expense` y **nadie lee ese parámetro**
  (grep: 0 usos de `searchParams` fuera del callback de auth): abre el dashboard y listo.
- No hay `favicon.ico` ni `apple-touch-icon.png`, aunque el middleware los excluya.

**Arreglo:** generar los PNG (incluido el maskable) y leer `?quick=expense|income` para abrir el
sheet con el tipo ya elegido. Es el camino de 1 toque desde la pantalla de inicio del teléfono.

### F6 · P2 — Ajuste por inflación (contexto argentino)
Comparar septiembre 2025 con septiembre 2026 en pesos nominales no dice nada, y hoy la app solo
compara nominal ("▲38% vs. agosto" puede ser inflación pura). Para alguien que trabaja con datos
de mercado es el agregado más valioso del histórico: elegir "pesos de hoy" y ajustar por
IPC/CER (o MEP) — ver `06-PREGUNTAS.md`.

### F7 · P2 — Sin dark mode, sin offline, sin notificaciones
Los tres estaban en "mejoras futuras" del README. Con tokens (V1) el dark sale casi gratis;
offline real necesita decidir estrategia de caché (y el SW hoy es un kill switch a propósito).

---

## Resumen por severidad

| | Hallazgos |
|---|---|
| **P0** | A1 (no refresca), A2 (mes vs fecha), D1 (cuotas divididas), D2 (firmas SQL), D3 (cumplimiento mal calculado), D4 (presupuesto sin mes) |
| **P1** | A3, A4, A5, A6, A7, D5, D6, D7, X1, X2, X3, X4, X5, X6, V1, V2, V3, P1, P2, P3, P4, F1, F2, F3 |
| **P2** | A8, A9, A10, D8, D9, X7, X8, V4, V5, V6, V7, P5, P6, F4, F5, F6, F7 |

Orden sugerido de trabajo en `00-RESUMEN.md`.
