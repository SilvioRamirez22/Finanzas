# Seguimiento — cómo evolucionan ingresos, gastos y plan

Pantalla nueva que reemplaza a `/historico`. Aprobada e implementada el 2026-09-22
(`src/app/seguimiento`, `src/components/seguimiento`, `src/lib/seguimiento.ts`). Prototipo navegable (claro y oscuro): Artifact privado
https://claude.ai/artifact/7CU77kB1usdLkro6EebqZJ

## Para qué

El dashboard responde "¿cómo vengo este mes?". Seguimiento responde "¿cómo vengo en el
tiempo?": si gasto más que antes, en qué, si ahorro, y si el plan del mes se cumple.

## Contenido (de arriba hacia abajo, en el celular)

1. **Período**: últimos 6 / 12 meses, hasta el mes elegido en la barra de mes.
2. **Promedio por mes**: ingresos, gastos y % de ahorro de los meses **cerrados** (el mes en
   curso no entra en el promedio), contra el mismo largo anterior cuando hay datos.
3. **Ingresos y gastos**: barras agrupadas por mes; tocar un mes muestra su detalle. El mes en
   curso lleva la proyección punteada. Colores validados: `#15803D` / `#DC2626` (claro),
   `#127F42` / `#FB8168` (oscuro), gastos con trama para que se lea sin color.
4. **Cuánto ahorraste**: % del ingreso por mes con la línea de meta (10 % hasta que exista el
   ahorro objetivo del plan). Un gráfico aparte: nunca doble eje.
5. **Gasto contra el plan**: barra de lo gastado con la marca del plan del mes y el exceso en
   rojo. Meses sin plan en gris. Depende del presupuesto por mes (etapa 4); hasta entonces la
   tarjeta invita a armar el plan.
6. **Por categoría**: mapa de calor categoría × mes, cada celda contra el promedio de esa
   categoría (verde abajo, terracota arriba, gris cerca). El mes en curso no se colorea. Tocar
   una categoría abre su evolución con la línea del promedio.
7. **Qué cambió**: 3-4 frases calculadas (subas o bajas sostenidas, plan excedido varios meses)
   con acción cuando la hay.

Montos nominales, sin ajuste por inflación (decisión 17 de `06-PREGUNTAS.md`).

## Navegación

En el celular pasa a la barra de abajo en lugar de Cuentas (el saldo por cuenta ya está en el
Resumen y Cuentas queda en "Más"). En escritorio reemplaza a Histórico.

## Datos

- `get_monthly_evolution(p_months)` ya existe (ingresos/gastos por mes).
- Implementado sin SQL nuevo: `getTransactionsLite` trae 24 meses (5 columnas, paginado de a
  1000) y `buildSeries` arma meses y categoría × mes en memoria. Si algún día pesa, pasar a una
  RPC `get_category_evolution(p_months)`.
- "Qué cambió" no repite el ahorro contra la meta (ya está en su tarjeta).
- Plan por mes: sale del modelo de la etapa 4 (`05-PRESUPUESTO.md`).
