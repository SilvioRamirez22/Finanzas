# Auditoría de diseño + plan — Finanzas Personales

Trabajo hecho el 2026-09-17 sobre el commit `3d6bd60`, leyendo las 5.311 líneas de `src`, el
SQL y la configuración. No pude levantar la app (no hay `.env.local`: las claves viven en
Vercel), así que todo lo que sigue sale del código; los tres puntos que dependen de lo que
realmente corre en Supabase están marcados y tienen su chequeo en `06-PREGUNTAS.md` §25.

## Los documentos

| Archivo | Qué hay adentro |
|---|---|
| [`01-AUDITORIA.md`](01-AUDITORIA.md) | 47 hallazgos con severidad, `archivo:línea` y arreglo |
| [`02-DESIGN-SYSTEM.md`](02-DESIGN-SYSTEM.md) | Tokens de color (con contraste medido), tipografía, espaciado, foco, primitivas a extraer |
| [`03-FLUJO-MOVIMIENTO.md`](03-FLUJO-MOVIMIENTO.md) | El flujo de carga, de 15-20 toques a 3 |
| [`04-GLOBAL-DASHBOARD.md`](04-GLOBAL-DASHBOARD.md) | Jerarquía de la vista global, barra de mes, gráficos (paleta validada) |
| [`05-PRESUPUESTO.md`](05-PRESUPUESTO.md) | El módulo que falta: modelo, SQL, pantallas, copy, fases |
| [`06-PREGUNTAS.md`](06-PREGUNTAS.md) | 26 preguntas con recomendación por defecto |

Maqueta interactiva de las pantallas propuestas: ver el enlace en la conversación (Artifact
privado).

---

## Lo que encontré, en una carilla

**La app está mucho mejor de lo que suele estar un proyecto personal a esta altura.** Los
comentarios del código muestran que ya se pelearon los problemas difíciles y reales: el rebote
de sesión en el celular, el service worker fantasma, el scroll horizontal en 360 px, los saldos
al editar, el manejo de fechas de cuotas a fin de mes. Eso no se nota en una captura pero es la
parte que hace que una PWA sea usable.

Lo que falta es de otra naturaleza: **el ciclo de escritura está roto y el sistema visual no
existe como sistema.**

### Los seis P0 (revisados contra producción el 2026-09-17)

1. **Cargás un movimiento y la pantalla no cambia** (A1). El modal global solo refresca los
   saldos; el dashboard y la lista no se enteran. Es el bug más caro: te hace dudar de si el
   gasto se guardó.
2. **El mes que mirás y la fecha del movimiento no se hablan** (A2): cargás mirando agosto y se
   guarda en septiembre, sin aviso y sin aparecer en ningún lado.
3. **Los saldos no arrancan de ningún lado** (D10, hallazgo nuevo): las 6 cuentas tienen
   `initial_balance = 0`, así que el "Saldo total" del dashboard hoy es **−$13.505.586** — no
   es plata, es la suma de todo lo cargado desde 2024. Bloquea la tarjeta "Disponible" del
   rediseño.
4. **El SQL del repo no es el que corre en producción** (D2): las funciones buenas están en
   Supabase y el archivo `INSTALAR_TODO.sql` tiene versiones viejas. Correrlo rompe el
   dashboard y las cuotas. No se ve en pantalla, pero está esperando.
5. **El presupuesto no tiene mes** (D4): hay un monto por categoría para toda la eternidad;
   editarlo hoy reescribe el pasado. (La tabla `budgets` está vacía: el módulo arranca limpio.)
6. **El gráfico de cumplimiento compara todo el gasto contra el presupuesto de hoy** (D3): dice
   "te pasaste" casi siempre.

**Descartado tras verificar:** las cuotas **no** se guardan divididas (D1) — la función en
producción no divide; el archivo del repo sí. Y sumar monedas (D6) hoy no afecta nada: las 6
cuentas son en pesos.

**Nuevos al mirar los datos:** las dos tarjetas de crédito llevan signos opuestos (D11), y solo
3 de 1.115 movimientos están marcados como fijos (D12), así que la detección automática pasa a
ser parte de esa feature.

### Los tres problemas transversales

- **Accesibilidad:** cero indicadores de foco en toda la app (39 `outline-none`, 0
  `focus-visible`), metadata en gris de 2,5:1 de contraste (el mínimo es 4,5:1), y controles de
  22-24 px pegados entre sí donde la guía pide 44 px con 8 px de aire. Además, **editar cuentas
  y categorías no funciona en el celular**: los botones solo aparecen con hover (X6).
- **Sistema visual:** tres paletas conviviendo (Tailwind, hex a mano en el dashboard, colores de
  la base), 26 `fontFamily` inline para los números, dos radios de tarjeta, y el botón de
  guardar un gasto en rojo, que es el color de "eliminar" en el resto de la app.
- **Estados:** `loading` se calcula en dos pantallas y **no se usa** en ninguna; no hay estado
  de error en ningún lugar. Al cambiar de mes seguís viendo los números del mes anterior como si
  fueran los nuevos.

### Lo que la estructura ya pide y no está

Medio de pago (tabla seedeada, nunca se carga), ciclo de la tarjeta de crédito
(`closing_day`/`due_day` sin usar), generación de los gastos fijos del mes (hoy solo se
detectan por texto), deshacer, íconos del PWA (el manifest apunta a dos PNG que no existen) y
el atajo "Nuevo gasto" de la pantalla de inicio, que no hace nada.

---

## Plan de trabajo sugerido

### Etapa 1 — Que no mienta (2-3 sesiones)
- ✅ A1: las pantallas se recargan solas al crear, editar o borrar (`dataVersion` +
  `useMonthData`), y también al volver a la app después de un rato (por si se cargó algo desde
  otro dispositivo). Sin actualización optimista todavía.
- ◐ P1/P2: esqueleto y estado de error en dashboard y movimientos. Falta presupuestos (se
  rehace en la etapa 4).
- ✅ A2: aviso de mes en el formulario con "Usar 31 de agosto", y "Ver septiembre" en el aviso
  de guardado. Además, "hoy" se calculaba en UTC: de noche ya era el día siguiente.
- ✅ D10 y X6 (commit `91bf5b4`).
- D1/D2: confirmar contra producción y alinear (copy, API y SQL).
- P3/P4: usar las RPC que ya existen y matar las 6 consultas en serie de presupuestos.

### Etapa 2 — Una sola pasada visual y de accesibilidad
✅ (2026-09-22) Toda la app usa los tokens de `globals.css` (el borde se llama `line`, para no
chocar con la utilidad `border` de Tailwind): cero clases `gray-*`/`emerald-*`/`red-*`, montos
con `.num`, tarjetas con un solo radio. **Modo oscuro** siguiendo al sistema (el override manual
necesitaría guardar la preferencia en el perfil de Supabase: pendiente). Foco visible global,
`prefers-reduced-motion`, íconos de categoría con lucide (se borró el `@import` de Tabler).
Pendiente de esta etapa: áreas táctiles de 44 px en todas las filas y las primitivas `Card`/`Money`.
- Tokens en `globals.css` + `tailwind.config` (`02`).
- `focus-visible` global, escala de grises con contraste, áreas táctiles de 44 px.
- X6: acciones visibles en táctil en cuentas y categorías.
- Primitivas `Card`, `Money`, `Chip`, `ProgressBar`, `Skeleton`, `EmptyState`, `ErrorState`.
- Borrar el `@import` de Tabler y mapear los íconos de la base a lucide.

### Etapa 3 — El flujo de carga (`03`)
✅ Hecho (2026-09-22): `Sheet` con contrato de diálogo, teclado propio con `000`, chips de
categoría (por uso en 90 días) y subcategoría, fecha en chips con el día del mes visible, cuenta
preelegida (la última usada), "Más opciones" con descripción autocompletada, medio de pago,
cuotas, fijo y notas, "Guardar y otro", deshacer al crear y al borrar (sin `confirm()`).
Distinto de la spec: la última cuenta sale de Supabase y no de `localStorage` (vale en todos los
dispositivos); sin cola offline (guardaría datos en el navegador) y sin actualización optimista
(la recarga en segundo plano de la etapa 1 alcanza por ahora).

### Etapa 4 — Presupuesto (`05`)
✅ Fase 0 y 1 (2026-09-22). Topes por intervalo sobre `budgets` (sin tabla nueva): "desde este
mes" o "solo este mes", nunca cambia meses pasados (probado con 19 casos). Vista del mes con plan,
ritmo, fijos/cuotas/variable por separado, categorías ordenadas por riesgo, "sin presupuesto" con
acción, cumplimiento correcto (D3). Editor a pantalla completa con "sin asignar" en vivo, copiar
del mes anterior y sugerir por promedio; la primera vez viene prellenado. Tarjeta del plan en el
Resumen y "Gasto contra el plan" en Seguimiento.
Distinto de la spec: sin RPC nuevas (se calcula en el cliente con 3 consultas) y el editor usa el
teclado numérico del sistema. **Pendiente del lado de Supabase:** correr
`sql/migrations/001_presupuesto_por_mes.sql` (crea `month_plans`); hasta entonces el ingreso
esperado y el ahorro no se guardan y la app lo avisa.
✅ F3 (2026-09-22): "Cargar fijos" en el Resumen y en el plan. Propone los fijos del mes anterior
que no aparecen (monto editable, mismo día del mes) y, como casi nada está marcado (D12), también
lo que se repitió una vez por mes los últimos 3 meses con montos parecidos; esos vienen
destildados y al cargarlos quedan marcados. Carga en lote con Deshacer. Lógica en `lib/fixed.ts`,
la misma que usan el Resumen y el plan para "faltan cargar".
✅ Tarjeta "Atención" en el Resumen (2026-09-22), arriba de todo y solo si hay algo: categorías
excedidas, saldos sin punto de partida (D10), fijos sin cargar, categorías adelantadas al ritmo
del mes y gastos sin categoría (A4, con filtro "Sin categoría" en Movimientos). Cada una con su
acción. De paso: las grillas de Resumen, Presupuesto y Seguimiento usan `minmax(0,1fr)`; sin eso
un texto largo estiraba la columna más que el celular.

### Seguimiento (`07`)
✅ (2026-09-22) `/seguimiento` reemplaza a `/historico` (que redirige). En el celular va en la barra
de abajo en lugar de Cuentas, que pasa a "Más". Sin SQL nuevo: trae 24 meses de movimientos
paginados y calcula en memoria. "Gasto contra el plan" espera al presupuesto por mes (etapa 4).

### Etapa 5 — Vista global (`04`)
Reordenar el dashboard (disponible primero, tarjeta "Atención"), barra de mes con swipe, un solo
modelo de período, gráficos con la paleta validada.

### Etapa 6 — Lo demás
Dark mode, íconos y atajos del PWA, resumen de tarjeta, generación de fijos, ajuste por
inflación, `ignoreBuildErrors: false` y limpieza de código muerto.

---

## Decisiones tomadas (2026-09-17)

Las 26 preguntas están respondidas: la tabla completa abre `06-PREGUNTAS.md`. Las que cambian
el rumbo:

- Presupuesto = **plan del mes** (ingreso − ahorro = disponible; fijos y cuotas aparte; número
  de "sin asignar"), independiente por mes y sin rollover por ahora.
- Cuotas: el monto que se carga es el de **cada cuota** → se arregla la función SQL.
- Saldo = **solo lo confirmado**, con "comprometido a futuro" como línea aparte.
- Cuentas en USD: **se muestran aparte, nunca sumadas** al total en pesos.
- Carga: **teclado propio**, categoría en chips, descripción opcional, medio de pago se carga,
  borrar con **deshacer** en vez de `confirm()`, y botón para **cargar los fijos del mes**.
- **Modo oscuro sí** (sigue al sistema), densidad compacta en listas.
- Gráficos: **verde y rojo** con los pasos que validan (`#15803D` / `#DC2626`) más etiquetas
  directas y trama en gastos — ver la nota en `04-GLOBAL-DASHBOARD.md` §3.2.
- Sin ajuste por inflación por ahora. Tarjeta de crédito, en fase 2.
- Orden de trabajo: **Etapa 1 primero**.

Pendientes de tu lado: la URL de producción, el `.env.local` si querés que levante la app acá,
y la verificación SQL de 2 minutos (`06-PREGUNTAS.md` §25) que confirma D1 y D2.
