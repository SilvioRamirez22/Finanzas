# Sistema de diseño — Finanzas Personales

Objetivo: que la app deje de decidir colores, tamaños y radios en cada archivo. Un set de
tokens, ocho primitivas, y reglas de números. Todo lo que sigue respeta la identidad que ya
tiene la app (crudo cálido + verde) — no es un rediseño de marca, es formalizar lo que hay y
arreglar contraste, foco y densidad.

Dirección de estilo: **minimalismo tipo Swiss / dashboard denso** (la búsqueda del skill
`ui-ux-pro-max` con densidad 8 y movimiento 2 devolvió *Minimalism & Swiss Style*: rejilla,
mucho aire entre bloques, poco color, tipografía como jerarquía). No adoptamos la paleta ni la
tipografía que sugirió (venían de un perfil de landing/fintech oscuro con fuentes
manuscritas: no aplica a una app de datos en uso diario).

---

## 1. Color

### Tokens (claro)

```css
:root {
  /* superficies */
  --bg:            #F5F4F0;  /* fondo de app, crudo cálido (ya en uso) */
  --surface:       #FFFFFF;  /* tarjetas */
  --surface-2:     #FAF9F6;  /* filas alternas, bloques dentro de tarjeta */
  --border:        #E4E1D9;  /* borde de tarjeta e inputs */
  --border-strong: #CFCBC1;  /* separadores con peso, marca de 100% */

  /* texto (contraste medido sobre --surface) */
  --ink-900: #1A1A17;  /* 17.4:1 — números héroe, títulos */
  --ink-700: #454239;  /* 10.0:1 — texto de cuerpo */
  --ink-500: #6E6B64;  /*  5.3:1 — metadata, labels, ayudas  ← reemplaza gray-400 */
  --ink-300: #C9C5BC;  /*  decorativo: bordes, íconos apagados. NUNCA texto */

  /* marca y semántica */
  --brand:      #047857;  /* 5.5:1 sobre blanco; blanco sobre él 5.5:1 */
  --brand-ink:  #065F46;  /* 7.7:1 — texto/estado activo sobre claro */
  --brand-soft: #E7F3EE;  /* fondo de selección */

  --pos:  #0F6B4F;  /* 6.5:1 — ingresos, ahorro, dentro de presupuesto */
  --neg:  #B0402B;  /* 5.8:1 — gastos, excedido (terracota, ya en la app) */
  --warn: #8A5A06;  /* 5.9:1 — atención (80-100% del presupuesto) */
  --info: #1E5FA8;  /* 6.5:1 — transferencias */
  --pos-soft: #E6F1EC;  --neg-soft: #F7E9E5;  --warn-soft: #F6EEDC;

  --ring: #047857;  /* foco */
}
```

### Tokens (oscuro)

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #14151A;  --surface: #1C1E25;  --surface-2: #232630;
    --border: #2C303B;  --border-strong: #3A3F4D;
    --ink-900: #E9E7E2;  /* 14.8:1 */
    --ink-700: #C9C6BF;
    --ink-500: #A9A59C;  /*  7.4:1 */
    --ink-300: #6B6F78;
    --brand: #34D399;  --brand-ink: #34D399;  --brand-soft: #123A2E;
    --pos: #4ADE80;  --neg: #FF8A72;  --warn: #F7C453;  --info: #7CB3F5;
    --pos-soft: #10291D;  --neg-soft: #33150F;  --warn-soft: #2E2410;
    --ring: #34D399;
  }
}
```

Reglas:
- **Nada de `text-gray-400` para texto.** Era 2,5:1 (ver X2 en la auditoría). Metadata =
  `--ink-500`.
- **El color nunca comunica solo.** "Excedido" lleva color + `+$12.400` + ícono; los estados de
  presupuesto se leen igual en escala de grises.
- **Rojo = destructivo o excedido.** Guardar un gasto es `--brand`, no rojo (V2).
- Los colores de categoría que vienen de la base se usan como **identidad** (punto de 8 px,
  fondo de ícono al 12 %), nunca para codificar magnitud ni estado.

### Rampa para datos (barras de "gastos por categoría")

Secuencial de un solo tono, del más gastado al menos:
`#B0402B` → `#C4765C` → `#D9A794` → `#E3CFC6` → resto `--ink-300`.
Es lo que ya hacía el dashboard con `#B54A32 / #C08268 / #D5D2CB`, ahora con contraste
suficiente y nombre propio (`--data-1..4`).

---

## 2. Tipografía

Se queda **Inter** (ya cargada con `next/font`, sin request extra). Se van los 26
`fontFamily: 'ui-monospace'` inline (V3) y entra una clase:

```css
.num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; letter-spacing: -0.01em; }
```

Todos los montos llevan `.num`: mismo ancho por dígito, columnas alineadas, mismo aspecto en
iPhone / Android / Windows. (La base del skill sugería *Fira Code + Fira Sans* para
dashboards; no vale 2 requests más para algo que Inter ya hace con `tnum`.)

Escala (móvil → escritorio):

| Rol | Tamaño | Peso | Notas |
|---|---|---|---|
| Número héroe (resultado, saldo) | 26 → 34 | 600 | `.num`, `tracking-tight` |
| Número de tarjeta (KPI) | 20 | 600 | `.num` |
| Título de página (`h1`) | 20 | 600 | lo pone el layout, no la página |
| Título de sección (`h2`) | 14 | 600 | `--ink-900` |
| Cuerpo / fila | 14 | 400 | `--ink-700` |
| Monto en fila | 14 | 500 | `.num` |
| Metadata | 12 | 400 | `--ink-500` |
| Label de campo | 12 | 500 | `--ink-500`, visible siempre |
| Overline (`RESULTADO DEL MES`) | 11 | 600 | `tracking-wide`, `--ink-500` |
| Input | **16 px en móvil** | 400 | obligatorio: menos de 16 hace zoom en iOS |

Sin texto de contenido por debajo de 12 px. Alto de línea 1,45 en cuerpo; 1,1 en números
grandes.

---

## 3. Espaciado, radios, sombras

```css
--space-1: 4px; --space-2: 8px;  --space-3: 12px; --space-4: 16px;
--space-5: 24px; --space-6: 32px; --space-7: 48px;

--r-sm: 8px;  --r-md: 12px; --r-lg: 16px; --r-sheet: 20px; --r-pill: 999px;

--shadow-card:  0 1px 2px rgb(26 22 16 / .04), 0 1px 3px rgb(26 22 16 / .06);
--shadow-sheet: 0 -8px 30px rgb(0 0 0 / .18);
--shadow-fab:   0 6px 16px rgb(4 120 87 / .28);
```

- Padding de tarjeta: 16 móvil / 20 escritorio. Gap entre tarjetas: 12 móvil / 16 escritorio.
- Un solo radio por familia: tarjetas `--r-lg`, controles `--r-md`, chips `--r-pill`. Hoy hay
  `rounded-xl` y `rounded-2xl` mezclados (V4).
- Una sola sombra de tarjeta (`shadow-card` ya existe en el config y no se usa).

## 4. Toques y foco

- Objetivo táctil mínimo **44×44 px**, separación mínima 8 px. Para íconos chicos:
  `className="p-2.5 -m-2.5"` (agranda el área sin cambiar el diseño).
- Foco visible global (X1):

```css
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  border-radius: 6px;
}
```

- Estado presionado en táctil: `active:scale-[.98]` + cambio de fondo (en táctil no hay hover).
- Todo control interactivo: `cursor-pointer`.

## 5. Movimiento

| Caso | Duración | Curva |
|---|---|---|
| Presionar / hover | 120 ms | `ease-out` |
| Entrada de sheet / tarjeta | 200 ms | `cubic-bezier(.2,.8,.2,1)` |
| Salida | 150 ms | `ease-in` (más rápido que la entrada) |
| Barras de progreso al cargar | 400 ms | `ease-out`, solo una vez |

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

Nada de animar `width`/`height` (usar `transform`), salvo las barras de progreso donde el
valor es el dato.

---

## 6. Primitivas a extraer (hoy están copiadas y pegadas)

| Componente | Reemplaza | Notas |
|---|---|---|
| `Card` | 30+ `div.bg-white.rounded-xl.border` | props: `title`, `action`, `dense` |
| `SectionTitle` | 3 variantes de `h2/h3` | siempre 14/600 `--ink-900` |
| `Money` | 26 estilos inline + signos ad hoc | props: `value`, `signed`, `size`, `currency`; aplica `.num`, decide color por signo |
| `Chip` | pills de filtros, meses, tipos | estados: default / selected / disabled; 44 px de alto en móvil |
| `Sheet` | 4 modales distintos (alta, presupuesto, cuenta, categoría) | `role="dialog"`, foco atrapado, Escape, scroll lock, footer sticky, handle |
| `ProgressBar` | 3 implementaciones (dashboard, presupuestos, histórico) | props: `pct`, `state`, `marker` (día del mes) |
| `StatTile` | sub-métricas del dashboard | label / valor / delta con color semántico |
| `ListRow` | filas de movimientos, cuentas, categorías | `<button>` real + slot de acciones + área táctil |
| `Skeleton` / `EmptyState` / `ErrorState` | hoy no existen (P1, P2) | los tres estados son obligatorios en cada tarjeta que consulta datos |
| `Keypad` | nuevo (ver `03-FLUJO-MOVIMIENTO.md`) | teclado numérico propio |
| `MonthBar` | `MonthNav` | ancho completo, 44 px, swipe |

Estados obligatorios por pantalla que consulta datos: **cargando (skeleton) · vacío (con
acción) · error (con reintentar) · con datos**. Hoy solo existe el último.

---

## 7. Cómo se aterriza en el código

1. `globals.css`: bloque `:root` con los tokens, el `focus-visible`, `.num`, la guarda de
   `prefers-reduced-motion`. Borrar el `@import` de Tabler (V5).
2. `tailwind.config.ts`: mapear tokens a utilidades, para poder escribir `bg-surface`,
   `text-ink-500`, `text-neg`:

```ts
colors: {
  bg: 'var(--bg)', surface: 'var(--surface)', 'surface-2': 'var(--surface-2)',
  border: 'var(--border)',
  ink: { 900: 'var(--ink-900)', 700: 'var(--ink-700)', 500: 'var(--ink-500)', 300: 'var(--ink-300)' },
  brand: { DEFAULT: 'var(--brand)', ink: 'var(--brand-ink)', soft: 'var(--brand-soft)' },
  pos: 'var(--pos)', neg: 'var(--neg)', warn: 'var(--warn)', info: 'var(--info)',
}
```

3. Migración por pantalla, no global: `movimientos` → `dashboard` → `presupuestos` → resto.
   Regla de oro durante la transición: **ningún archivo nuevo escribe un hex**.

---

## 8. Checklist antes de dar una pantalla por terminada

- [ ] Contraste ≥ 4,5:1 en todo texto (≥ 3:1 solo si es ≥ 24 px o ≥ 19 px bold)
- [ ] Ningún estado comunicado solo por color
- [ ] Foco visible en todos los controles, orden de tabulación lógico
- [ ] Toques ≥ 44 px, con 8 px de aire; destructivo separado del resto
- [ ] Labels visibles (nunca placeholder como único label)
- [ ] Los cuatro estados: cargando / vacío / error / con datos
- [ ] Sin scroll horizontal a 360 px; probado a 360, 390, 768 y 1280
- [ ] Números con `.num` y signo explícito
- [ ] Funciona en claro y oscuro
- [ ] `prefers-reduced-motion` respetado
- [ ] Área segura (notch y barra de gestos) respetada en sheets y barras fijas
