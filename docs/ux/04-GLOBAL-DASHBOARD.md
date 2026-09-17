# La vista global: navegación, dashboard y gráficos

Qué ve la persona cuando abre la app, en qué orden, y con qué gráficos.

---

## 1. Diagnóstico de la arquitectura actual

### 1.1 En el celular, el saldo queda debajo de todo

El dashboard es `grid lg:grid-cols-[1fr_380px]` (`dashboard/page.tsx:157`): en móvil las dos
columnas se apilan, y la izquierda va primera. Orden real en un teléfono:

1. Resultado del mes (+ sub-métricas)
2. Gastos por categoría (hasta 9 filas, con detalle expandible)
3. **Saldo total** ← la pregunta más frecuente, a ~1.100 px de scroll
4. Gastos fijos (con la lista completa)
5. Presupuesto
6. Últimos movimientos

"¿Cuánta plata tengo?" y "¿cómo vengo este mes?" son las dos preguntas que se hacen 20 veces
por mes. Hoy la primera está sepultada y la segunda está arriba pero sin contexto de ritmo.

### 1.2 El mes es contexto global pero se ve como un detalle

`MonthNav` compacto (58 px de ancho, flechas de 32 px) arriba a la derecha, al lado del
título, compitiendo con el botón de buscar (A10). Es el control que define qué muestran
**todas** las pantallas.

### 1.3 Dos modelos de período conviviendo

- `selectedMonth` en el store (dashboard, movimientos, presupuestos).
- Rango propio en `/historico` (3/6/12/todo, siempre terminando hoy) y en `/buscar` (fechas
  libres).
- `PeriodSelector.tsx`: un tercer modelo, más completo, **que no se usa** (P6).

Resultado: cambiás a "agosto" en el header, entrás a Histórico y ves los últimos 6 meses
hasta hoy sin ninguna relación con lo que elegiste, y sin que la pantalla lo diga.

### 1.4 La barra inferior está bien; lo demás del header, no

`Resumen · Movimientos · Presupuesto · Cuentas · Más` es correcto (4 + más, ≤ 5). Pero:
- Inversiones queda escondido en "Más" aunque sea una pestaña principal en escritorio
  (dos jerarquías distintas según el ancho de pantalla).
- El header de escritorio repite navegación (tabs + menú Más) con el estado activo en dos
  lugares.
- "Personal | Config" en el header de escritorio parece un selector de perfil y es un link.

---

## 2. Arquitectura propuesta

### 2.1 Jerarquía de la información (móvil, de arriba hacia abajo)

```
┌─ barra de mes (ancho completo, 44 px, swipe) ───────┐
│  ‹      septiembre 2026      ›            [buscar]  │
├─ 1. DISPONIBLE ─────────────────────────────────────┤
│  $ 1.284.300                                        │
│  Efectivo 120k · Banco 940k · MP 224k               │
│  comprometido a futuro: cuotas $180k  (D5)          │
├─ 2. CÓMO VENGO ESTE MES ────────────────────────────┤
│  Gastaste  $842.000  de $1.050.000 planeado         │
│  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░  80%     │ día 17 de 30        │
│  Vas $61.000 arriba del ritmo · proyección $1.48 M  │
│  ──────────────────────────────────────────────     │
│  ingresos 1.9 M ▲2%  ·  gastos 842k ▲12%  ·  ahorro 44% │
│  [ ▁▃▂▅▄▆ ]  últimos 6 meses (sparkline)            │
├─ 3. ATENCIÓN (solo si hay algo) ────────────────────┤
│  · 3 gastos fijos sin cargar (luz, internet, gym)   │
│  · Ocio se pasó del presupuesto (+$12.400)          │
│  · 8 movimientos sin categoría ($96.300)            │
├─ 4. GASTOS POR CATEGORÍA ───────────────────────────┤
├─ 5. GASTOS FIJOS DEL MES ───────────────────────────┤
├─ 6. ÚLTIMOS MOVIMIENTOS  → ver todos                │
└─────────────────────────────────────────────────────┘
```

En escritorio: (1) y (2) arriba en dos columnas, (3) como banda, (4) a la izquierda, (5)(6) a
la derecha.

Los tres cambios que importan:

1. **Disponible primero.** Es el dato que se consulta más y hoy está más abajo que la lista de
   categorías.
2. **"Cómo vengo" con ritmo, no solo con saldo.** El dato accionable es "a esta altura del mes
   deberías haber gastado 57 %, vas 80 %". El cálculo de proyección ya existe
   (`dashboard/page.tsx:99-105`) pero está escondido como tercera sub-métrica en 11 px.
3. **Una tarjeta "Atención" que reúne lo accionable.** Hoy los fijos pendientes viven dentro
   de la tarjeta de fijos, el exceso de presupuesto en otra tarjeta, y los no categorizados en
   ninguna (A4). Juntos y arriba, con acción directa en cada línea.

### 2.2 Barra de mes (reemplaza `MonthNav`)

- Ancho completo, debajo del header, sticky con el header.
- Flechas de 44×44 px; el nombre del mes es un botón que abre un selector de mes/año en grilla.
- **Swipe horizontal** en el área de contenido cambia de mes (con `touch-action: pan-y` para no
  romper el scroll vertical).
- Chip "Hoy" cuando estás en un mes que no es el actual.
- Estado en la URL (`?m=2026-09`) para que compartir/recargar mantenga el mes y el botón atrás
  funcione.

### 2.3 Un solo modelo de período

`selectedMonth` se convierte en `period: { kind: 'month' | 'range', ... }` y lo respetan las
cuatro pantallas de lectura. `/historico` deja de tener selector propio: usa el global, con
"últimos N meses **hasta** el mes seleccionado". `PeriodSelector.tsx` (ya escrito y sin usar)
es la base del control; se le agrega el caso "mes puntual" que ya tiene.

### 2.4 Estados que faltan en todas las pantallas

| Estado | Hoy | Debe ser |
|---|---|---|
| Cargando | nada (P1) | skeleton por tarjeta, alto reservado |
| Vacío (mes sin datos) | "Sin gastos este mes" en gris 1,9:1 | texto claro + acción ("Cargar el primero", "Copiar fijos de agosto") |
| Error | pantalla en blanco (P2) | motivo + "Reintentar" en la tarjeta que falló |
| Mes futuro | igual que uno vacío | "Todavía no empezó" + fijos/cuotas ya comprometidos del mes |

---

## 3. Gráficos

Método aplicado: primero la forma según el trabajo del dato, después el color, y el color se
valida con script (skill `dataviz`).

### 3.1 Gastos por categoría — barras horizontales, **un solo tono**

Trabajo del dato: comparar magnitudes de una sola medida. Es **una serie**, así que:

- **Un solo color para todas las barras** (`--data-1 #B0402B`). Hoy el dashboard pinta la
  primera barra oscura, las 2-3 siguientes intermedias y el resto gris
  (`dashboard/page.tsx:277`): eso es *color por ranking*, que es un anti-patrón — el orden y el
  largo ya comunican el ranking, y el color cambia de significado cuando cambia el filtro.
- Orden descendente, "Otras N" al final, fila "Sin categoría" cuando exista (A4).
- Valor a la derecha, siempre visible (así la barra no necesita eje).
- La variación vs. mes anterior en texto (`▲12%`), no en color de barra.
- Expandible al detalle de movimientos: eso ya está muy bien resuelto y es, de hecho, la
  "vista de tabla" que pide la accesibilidad.
- Sin leyenda (una sola serie: el título alcanza).

### 3.2 Ingresos vs gastos — 6 barras agrupadas (sparkline del mes)

Dos series, comparación temporal corta. Barras agrupadas por mes, 2 px de separación entre
fills, mes actual con etiqueta directa y los demás sin números.

**Color decidido: verde y rojo** (se mantiene la convención de finanzas), con los pasos que sí
validan (`scripts/validate_palette.js`):

| Uso | Claro | Oscuro |
|---|---|---|
| Ingresos | `#15803D` | `#127F42` |
| Gastos | `#DC2626` | `#FB8168` |

- **Claro:** pasa las cinco comprobaciones — banda de luminosidad, piso de croma, separación en
  daltonismo ΔE 8,6 (deutan), piso de visión normal 31,5 y contraste ≥ 3:1.
- **Oscuro:** ΔE 11,0 y contraste OK, pero el rojo queda apenas más claro que la banda
  recomendada para fondos oscuros (L 0,74 contra un techo de 0,67). Es el costo de sostener
  verde/rojo en dark: ninguna combinación de los dos cumple las dos cosas a la vez.

> Lo que hoy usa la app (`#0F6B4F` / `#B0402B`) **falla** la separación para protanopía
> (ΔE 5,7): esos dos pasos no se usan en gráficos.
>
> **Codificación secundaria obligatoria** (es lo que hace legal el par verde/rojo): etiqueta de
> valor directa en las barras que importan, trama diagonal a 45° en la serie de gastos, y orden
> fijo (ingresos siempre a la izquierda de su par). El gráfico tiene que leerse igual impreso en
> blanco y negro.

### 3.3 Progreso de presupuesto — barra con marca de día, no medidor circular

- Barra lineal de 8 px, `--r-pill`, con **marca vertical en el día del mes** (`día 17/30 →
  57 %`): así se lee "¿voy adelantado?" de un vistazo. La marca de 100 % ya existe en
  `presupuestos/page.tsx:157`; se suma la del ritmo.
- Estados con color **+ etiqueta**: `dentro` (`--pos`), `atención ≥ 80 %` (`--warn`),
  `excedido > 100 %` (`--neg`) y el excedente en número (`+$12.400`).
- Nada de donas ni gauges: un porcentaje único se lee mejor como número grande + barra, y la
  dona no deja mostrar el ritmo.

### 3.4 Histórico

- La evolución 12 meses se queda en barras agrupadas (recharts ya está), pero:
  - eje Y con `formatCompact` (`$2,4 M`) — hoy imprime el monto completo en 10 px (V7);
  - **nunca doble eje**: si se quiere sumar "% de ahorro", va en un gráfico chico aparte;
  - tooltip con los tres números del mes y el neto.
- La tabla "Comparativa mes a mes" con `min-w-[500px]` fuerza scroll horizontal en móvil: en
  < 768 px se convierte en tarjetas de dos líneas por mes.
- Si se agrega ajuste por inflación (F6), el toggle "pesos de hoy / nominales" va arriba del
  gráfico y se aplica a todo el histórico, con nota de la fuente del índice.

### 3.5 Reglas comunes

- Hover/tooltip en todo gráfico (es HTML, no una imagen).
- Los textos usan tokens de texto (`--ink-*`), nunca el color de la serie.
- Grilla y ejes recesivos (`--border`), sin bordes en las barras.
- Toda serie tiene su equivalente en texto/tabla en la misma pantalla.

---

## 4. Navegación

- Móvil: la barra inferior queda igual (`Resumen · Movimientos · Presupuesto · Cuentas · Más`),
  pero el orden de "Más" arranca con lo más usado (Inversiones, Histórico, Categorías, Buscar,
  Configuración) y el ítem activo se marca también cuando está adentro de "Más" (hoy ya lo
  hace: bien).
- Escritorio: una sola fila de navegación (sin el bloque "Personal | Config"), menú "Más" con
  botón + `aria-expanded` (A9), y el mes a la izquierda del buscador.
- FAB: se queda arriba de la barra inferior. Agregar `?quick=expense` funcionando (F5) para el
  atajo del PWA y un long-press → "Nuevo ingreso".
- Botón atrás: hoy el sheet de alta no participa del historial; al abrirlo, el botón atrás del
  teléfono sale de la app en vez de cerrar el sheet. Se resuelve con `history.pushState` al
  abrir (regla "back predecible").

---

## 5. Rendimiento de la vista global

1. Totales del mes por RPC (`get_month_summary`, ya existe y no se usa) en vez de bajar 5.000
   filas (P3).
2. Movimientos del mes: una sola bajada compartida por dashboard, movimientos y presupuesto
   (store o TanStack Query) — hoy cada pantalla baja lo mismo por separado.
3. Mes anterior: RPC chica que devuelva solo totales + fijos, no 5.000 filas.
4. Skeletons con alto fijo para que el layout no salte (CLS < 0,1).
5. `recharts` solo en `/historico` con `next/dynamic` (hoy entra en el bundle de esa ruta, que
   está bien; no llevarlo al dashboard: la sparkline se dibuja con 6 divs).
