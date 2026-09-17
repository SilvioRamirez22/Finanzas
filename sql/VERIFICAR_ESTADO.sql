-- ============================================================
-- VERIFICACIÓN: qué está corriendo realmente en Supabase
-- ============================================================
-- Solo lectura: no modifica nada. Pegar entero en el SQL Editor y ejecutar.
-- Sirve para confirmar o descartar dos hallazgos de docs/ux/01-AUDITORIA.md:
--   D1 · las cuotas se estarían guardando divididas
--   D2 · las firmas de las funciones no coinciden con lo que llama la app
-- ============================================================

-- (a) Firmas reales de las funciones que usa la app.
--     La app las llama SIN p_user_id. Si acá aparece "p_user_id uuid, ...",
--     el repo está viejo o esas llamadas están fallando en silencio.
select p.proname as funcion,
       pg_get_function_identity_arguments(p.oid) as parametros
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_month_summary','get_expenses_by_category',
                    'get_monthly_evolution','create_installments')
order by 1;

-- (b) ¿create_installments divide el monto por la cantidad de cuotas?
--     Buscar la línea "v_installment_amount := ROUND(p_total_amount / p_installments, 2)".
--     Si está, cargar "12 cuotas de $10.000" guarda 12 cuotas de $833.
select pg_get_functiondef(p.oid) as definicion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'create_installments';

-- (c) Comprobación directa sobre los datos: para cada compra en cuotas,
--     el monto de la cuota contra el total. Si la app venía mandando el valor
--     POR CUOTA como si fuera el total, estas compras quedaron divididas.
select t.description,
       t.installments_total as cuotas,
       t.amount             as monto_por_cuota,
       t.amount * t.installments_total as total_implicito,
       t.date
from transactions t
where t.installments_total > 1
  and t.installment_number = 1
order by t.date desc
limit 20;

-- (d) Estado de los presupuestos: ¿hay más de una fila activa por categoría?
--     ¿Alguna tiene end_date? (hoy la app nunca la escribe → todos abiertos)
select c.name as categoria,
       count(*) as filas_activas,
       min(b.start_date) as desde_mas_viejo,
       max(b.start_date) as desde_mas_nuevo,
       count(*) filter (where b.end_date is not null) as con_fecha_de_fin
from budgets b
join categories c on c.id = b.category_id
where b.is_active
group by c.name
order by filas_activas desc, categoria;

-- (e) Movimientos sin categoría: los que entran en el total del mes
--     y no aparecen en ningún desglose (hallazgo A4).
select date_trunc('month', t.date)::date as mes,
       count(*) as movimientos,
       sum(t.amount) as monto
from transactions t
where t.type = 'expense' and t.category_id is null and t.status <> 'cancelled'
group by 1
order by 1 desc
limit 6;

-- (f) Cuentas por moneda: confirma si el total del dashboard está sumando
--     pesos con dólares (hallazgo D6).
select currency, count(*) as cuentas, sum(current_balance) as saldo
from accounts
where is_active
group by currency;
