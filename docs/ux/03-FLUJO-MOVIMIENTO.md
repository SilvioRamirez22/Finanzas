# Flujo: cargar un movimiento

La acción que se repite 5-30 veces por mes. Todo lo demás en la app es lectura; esto es la
única escritura frecuente. Si acá hay fricción, los datos quedan incompletos y el resto de la
app miente.

---

## 1. Cómo es hoy (recorrido real, celular)

Dado: `QuickAddModal.tsx`, FAB en `AppLayout.tsx`.

| # | Acción | Toques | Problema |
|---|---|---|---|
| 1 | Tocar "+" | 1 | FAB a 76 px del borde inferior: bien ubicado |
| 2 | Sheet abre, intenta enfocar el monto a los 100 ms | — | En iOS el foco programático suele no abrir el teclado; y si lo abre, el layout salta |
| 3 | Escribir monto | 5-7 | `type="number"`: sin separadores de miles. "1250000" se lee mal; no hay forma de verificar de un vistazo |
| 4 | Tocar descripción, escribir | 1 + n | Teclado alfabético, sin sugerencias, sin historial. Es obligatoria (zod) aunque casi siempre repite algo ya cargado |
| 5 | Fecha | 0 | Bien: por defecto hoy |
| 6 | Cuenta | **3** | `<select>` nativo que arranca en "Elegir...". Obligatoria. Nunca recuerda la última |
| 7 | Categoría | **3** | `<select>` nativo, opcional → se saltea → rompe los reportes (A4) |
| 8 | Subcategoría (si hay) | 3 | Aparece/desaparece y mueve el layout |
| 9 | Cuotas / Gasto fijo | 1-3 | Dos bloques grises siempre visibles aunque casi nunca se usen |
| 10 | Guardar | 1 | Botón **rojo** (V2). Si el teclado está abierto, hay que cerrarlo para llegar (A7) |
| 11 | Resultado | — | Toast "Gasto registrado" y **la pantalla no cambia** (A1). El gasto no aparece |

**Total: 15-20 toques**, dos teclados distintos, y al final ninguna confirmación visual de que
el movimiento existe. El README promete "carga rápida en ≤10 segundos": hoy no se cumple.

Además:
- No hay medio de pago (F1) ni notas, aunque el schema los tenga.
- El monto en cuotas dice "valor de cada cuota" y se guarda dividido (D1).
- Backdrop cierra y descarta todo sin preguntar (A6).
- Si estás viendo otro mes, el movimiento se va a otro mes sin avisar (A2).

---

## 2. Objetivo

- **Gasto típico en 3 toques y menos de 8 segundos**, sin teclado del sistema.
- Categoría cargada en el 95 % de los movimientos (hoy es opcional y de 3 toques).
- Cero saltos de layout; el botón de guardar siempre alcanzable con el pulgar.
- Al guardar, el movimiento **aparece** donde la persona está mirando.

Referencia de patrón: apps de gasto rápido (Mercado Pago, Monzo, Fintonic) usan teclado propio
+ chips de categoría, no `<select>` nativos.

---

## 3. Diseño propuesto

### 3.1 Estructura del sheet (móvil, 100 % ancho, 88 vh)

```
┌──────────────────────────────┐
│ ───                          │  handle (arrastrar para cerrar)
│  Gasto  │ Ingreso │ Transf.  │  segmentado, 44 px, el activo tiñe el monto
├──────────────────────────────┤
│                              │
│        $ 12.500              │  ← 34 px, .num, se formatea al tipear
│        Alimentación · Efvo.   │  ← resumen en vivo de lo elegido (12 px, ink-500)
│                              │
├──────────────────────────────┤
│ 🛒 Súper  🚗 Nafta  🏠 Expensas│  ← CATEGORÍAS por frecuencia (90 días)
│ 🍔 Delivery  ⚡ Luz   ⋯ Más   │     grilla 3×2, chip = 1 toque, ícono + color de la base
├──────────────────────────────┤
│ Hoy │ Ayer │ 15 sep ▾        │  ← fecha: 3 chips (0 toques en el caso normal)
│ Efectivo │ Banco │ MP        │  ← cuenta: última usada preseleccionada
├──────────────────────────────┤
│ + Descripción, cuotas, fijo… │  ← un solo disclosure para todo lo demás
├──────────────────────────────┤
│  1  2  3                     │
│  4  5  6                     │  ← teclado propio, 56 px de alto por tecla
│  7  8  9                     │
│ 000 0  ⌫                     │
├──────────────────────────────┤
│  Guardar gasto · $12.500     │  ← sticky, brand, 48 px + pb-safe
│  Guardar y cargar otro       │  ← texto secundario, misma hoja
└──────────────────────────────┘
```

Escritorio (≥ 768 px): mismo contenido en modal centrado de 520 px, con el teclado propio
oculto (ahí sí hay teclado físico: el monto es un `<input>` con formato en vivo) y los chips en
grilla de 4 columnas.

### 3.2 Campo por campo

**Tipo** — segmentado Gasto / Ingreso / Transferencia. Gasto por defecto (es el 80 % de los
movimientos). Cambiar el tipo cambia la lista de categorías y el signo del monto, no el color
del botón primario.

**Monto** — teclado propio, nunca `type="number"`:
- Formateo en vivo con separadores: `1250000` → `$ 1.250.000`.
- `000` como tecla (un toque en vez de tres) y coma solo si la moneda tiene centavos.
- `⌫` largo = borrar todo.
- Si es en cuotas, debajo aparece `× 12 = $150.000` en 12 px.
- Nada de `inputMode` ni zoom de iOS: el teclado del sistema no participa.

**Categoría (chips)** — la decisión de diseño más importante:
- Orden: frecuencia de uso en los últimos 90 días del mismo `type`; empate → alfabético.
- 5 chips + "Más…" (hoja con todas, buscador arriba si hay > 15).
- Chip = ícono (mapeado de los nombres Tabler de la seed a lucide) + nombre + color de la base
  al 12 % de fondo; seleccionada: fondo `--brand-soft`, borde `--brand`, check.
- Si la categoría tiene subcategorías, al elegirla aparece **una fila** de subchips debajo
  (opcional, sin bloquear el guardado).
- Si no se elige ninguna: se guarda igual, pero el resumen dice `Sin categoría` en `--warn` y
  el movimiento queda listado en la fila "Sin categoría" del dashboard (A4).

**Fecha** — `Hoy` (default) · `Ayer` · `otra ▾` (abre el date picker nativo). Si el mes visible
no es el actual, se agrega un cuarto chip con el último día del mes visible y el aviso de A2.

**Cuenta** — chips con la última usada preseleccionada (`localStorage: finanzas:lastAccount`).
Si hay más de 4 cuentas: 3 más frecuentes + "Más…". Para transferencia, dos filas: `Desde` /
`Hacia`, y la de destino excluye la de origen (hoy se puede transferir a la misma cuenta).

**Más opciones (disclosure, cerrado por defecto)**
- **Descripción** con autocompletado del historial: al tipear 2 letras, hasta 5 sugerencias de
  descripciones ya usadas (con su categoría y monto típico). Elegir una sugerencia completa
  categoría y cuenta de una: ese es el camino de 2 toques para gastos repetidos.
- **Medio de pago** (F1): chips, con la última usada por cuenta. O se implementa acá o se borra
  del modelo; hoy es una tabla fantasma.
- **Pago en cuotas**: cantidad + resumen `12 × $12.500 = $150.000`, semántica definida en D1.
- **Gasto fijo**: switch con ayuda "se repite todos los meses".
- **Notas**: textarea de 2 líneas.

**Guardar**
- Botón primario `--brand` con el monto en la etiqueta: "Guardar gasto · $12.500". Con el monto
  vacío queda deshabilitado con el motivo al lado ("Falta el monto"), no con un error rojo.
- Secundario "Guardar y cargar otro": guarda, muestra un tick de 400 ms, limpia monto,
  descripción y cuotas, y **mantiene** categoría, cuenta y fecha. Es el modo "cargar los
  tickets del sábado".

### 3.3 Después de guardar

1. **Actualización optimista**: el movimiento se agrega al store y aparece en la lista/dashboard
   antes de que responda Supabase (arregla A1 de raíz).
2. Toast: "Gasto guardado · **Deshacer**" (5 s). Deshacer borra el movimiento recién creado.
3. Si el movimiento cae fuera del mes visible (A2): "Guardado en septiembre · **Ver septiembre**".
4. Si falla el guardado: el movimiento se marca en la lista con un ícono de reintento y el toast
   dice qué pasó ("Sin conexión: lo guardamos cuando vuelva"), en vez de perder lo tipeado.

### 3.4 Validación

- Inline, no al submit: el único campo bloqueante es el monto (> 0).
- La cuenta nunca bloquea porque siempre hay una preseleccionada.
- Errores debajo del campo, en `--neg`, con texto que dice cómo arreglarlo.
- El sheet no se cierra con backdrop si hay algo escrito: "¿Descartar este movimiento?"
  Descartar / Seguir editando.

### 3.5 Editar (mismo componente)

- Título "Editar movimiento", botón "Guardar cambios".
- Si es una cuota: banner arriba "Cuota 3 de 12 · compra de mayo" y las opciones de cuotas
  arrancan abiertas (hoy ese bloque ya está bien resuelto, solo cambia el envoltorio).
- Eliminar: dentro del sheet, abajo, en `--neg` como texto (no como botón primario), con
  deshacer.

---

## 4. Datos que hacen falta

Una sola RPC nueva para alimentar chips y sugerencias (se cachea en el store al entrar):

```sql
-- top categorías + descripciones frecuentes de los últimos 90 días
create or replace function get_quick_add_hints()
returns table (
  kind text,          -- 'category' | 'description'
  key  text,          -- category_id | descripción normalizada
  label text,
  category_id uuid,
  account_id uuid,
  last_amount numeric,
  uses int
) ...
```

Sin eso, la versión 1 se puede armar con lo que ya está en memoria (los movimientos del mes
cargado) — alcanza para ordenar las chips, aunque con 30 días en vez de 90.

---

## 5. Casos borde a cubrir

| Caso | Comportamiento |
|---|---|
| Sin cuentas creadas | El sheet muestra "Primero creá una cuenta" con botón a `/cuentas` |
| Una sola cuenta | La fila de cuentas no se muestra (se asume) |
| Transferencia | Sin categoría; destino ≠ origen; no puede ser "gasto fijo" |
| Monto 0 o vacío | Botón deshabilitado con motivo |
| Cuotas = 1 | Se guarda como gasto normal, sin sufijo `(1/1)` |
| Cuotas > 24 | Aviso "vas a generar 36 movimientos" antes de guardar |
| Mes visible ≠ mes de hoy | Aviso + chip con el último día del mes visible |
| Categoría desactivada que estaba en uso | Aparece en "Más…" marcada como inactiva, no se pierde |
| Sin conexión | Se encola y se reintenta; el movimiento se ve "pendiente de sincronizar" |
| Volver del background con token vencido | Se reintenta el guardado tras refrescar sesión, sin perder el formulario |

---

## 6. Criterios de aceptación

1. Gasto con categoría, cuenta y fecha de hoy: **≤ 3 toques** después de abrir el sheet.
2. El teclado del sistema **no aparece** en móvil salvo en descripción y notas.
3. El movimiento guardado se ve en pantalla en < 300 ms, sin recargar.
4. El sheet cumple el contrato de diálogo: Escape cierra, foco atrapado, fondo sin scroll,
   backdrop pide confirmación si hay cambios.
5. Todo control ≥ 44 px, foco visible, sin scroll horizontal a 360 px.
6. Cargar 8 movimientos seguidos no requiere cerrar el sheet ni una sola vez.
7. El monto guardado en cuotas coincide exactamente con lo que dice el resumen antes de
   guardar.

---

## 7. Orden de implementación

1. `Sheet` (contrato de diálogo) + footer sticky + refresco optimista → arregla A1, A6, A7.
2. `Keypad` + monto formateado → arregla el corazón del flujo.
3. Chips de categoría y cuenta con memoria y orden por frecuencia → A3, A4.
4. Disclosure "Más opciones" con medio de pago, cuotas, fijo y notas → F1.
5. Autocompletado de descripción (RPC de hints).
6. "Guardar y cargar otro" + deshacer.
