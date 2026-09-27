-- 002 · Seguridad y saldos (rescatado de sql/FIXES.sql del PR #1, 2026-09-07)
--
-- Se corre UNA vez en Supabase: SQL Editor → pegar todo → Run.
-- Es seguro correrlo de nuevo: no borra datos, no cambia montos ni fechas y no
-- toca las funciones RPC más que para fijarles el search_path.
--
-- Qué hace:
--   1. transactions_full respeta el RLS (security_invoker).
--   2. El saldo se recalcula en todas las cuentas que toca un movimiento
--      (origen y destino de una transferencia, cuenta vieja y nueva al editar).
--      Es lo mismo que sql/ARREGLO_SALDOS_AL_EDITAR.sql: si ya lo corriste, no
--      cambia nada.
--   3. trg_set_user_id en investment_transactions y month_snapshots, las dos
--      tablas donde faltaba.
--   4. search_path fijo en las funciones SECURITY DEFINER y un índice que usa
--      casi toda consulta de la app.
--
-- Lo que FIXES.sql traía y NO está acá:
--   - Categorías duplicadas (Celular, Expensas, Luz): modifica datos y es una
--     decisión tuya. El diagnóstico está en sql/VERIFICAR_ESTADO.sql (g).
--   - Saldos iniciales a mano: lo reemplaza "Ajustar saldo" en Cuentas (D10).


-- 1 · La vista corre con los permisos de quien consulta ------------------------
-- Sin esto la vista corre como su dueño (postgres) y se saltea el RLS de
-- transactions. Hoy no expone nada (hay un solo usuario), pero si la app se
-- comparte, cualquier usuario logueado leería los movimientos de todos.

alter view public.transactions_full set (security_invoker = true);


-- 2 · Saldos: recalcular todas las cuentas afectadas --------------------------

create or replace function public.recalculate_account_balance()
returns trigger as $fn$
declare v_id uuid;
begin
  foreach v_id in array array[
    case when tg_op <> 'INSERT' then old.account_id end,
    case when tg_op <> 'INSERT' then old.transfer_to_account_id end,
    case when tg_op <> 'DELETE' then new.account_id end,
    case when tg_op <> 'DELETE' then new.transfer_to_account_id end]
  loop
    continue when v_id is null;
    update public.accounts a set current_balance = a.initial_balance + coalesce((
      select sum(case
        when t.type = 'income'  then t.amount
        when t.type = 'expense' then -t.amount
        when t.type = 'transfer' and t.account_id = a.id then -t.amount
        when t.type = 'transfer' and t.transfer_to_account_id = a.id then t.amount
        else 0 end)
      from public.transactions t
      where (t.account_id = a.id or t.transfer_to_account_id = a.id)
        and t.status <> 'cancelled' and t.user_id = a.user_id), 0)
    where a.id = v_id;
  end loop;
  return null;
end;
$fn$ language plpgsql;

-- Recalcular una vez todas las cuentas. Con el trigger al día no debería
-- cambiar ningún saldo; si cambia alguno, estaba desfasado.
update public.accounts a set current_balance = a.initial_balance + coalesce((
  select sum(case
    when t.type = 'income'  then t.amount
    when t.type = 'expense' then -t.amount
    when t.type = 'transfer' and t.account_id = a.id then -t.amount
    when t.type = 'transfer' and t.transfer_to_account_id = a.id then t.amount
    else 0 end)
  from public.transactions t
  where (t.account_id = a.id or t.transfer_to_account_id = a.id)
    and t.status <> 'cancelled' and t.user_id = a.user_id), 0);


-- 3 · user_id automático en las dos tablas que faltaban -----------------------
-- La app no manda user_id en los INSERT: lo completa este trigger. Si algún día
-- escribe en estas tablas, sin él falla.

do $triggers$
declare t text;
begin
  foreach t in array array['investment_transactions', 'month_snapshots'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_set_user_id on public.%I', t);
      execute format(
        'create trigger trg_set_user_id before insert on public.%I '
        'for each row execute function public.set_user_id_on_insert()', t);
    end if;
  end loop;
end $triggers$;


-- 4 · search_path fijo en las funciones SECURITY DEFINER ----------------------
-- Es el aviso del linter de Supabase: una función con permisos elevados que
-- resuelve nombres de tabla según el search_path de quien la llama. ALTER
-- FUNCTION no toca el cuerpo. Si alguna firma no coincide, el script frena acá
-- sin haber cambiado nada de este bloque.

alter function public.get_month_summary(int, int)             set search_path = public;
alter function public.get_expenses_by_category(date, date)    set search_path = public;
alter function public.get_monthly_evolution(int)              set search_path = public;
alter function public.set_user_id_on_insert()                 set search_path = public;
alter function public.handle_new_user()                       set search_path = public;
alter function public.create_installments(uuid, uuid, uuid, uuid, uuid, text, numeric, int, date, text)
                                                              set search_path = public;

create index if not exists idx_transactions_user_status_date
  on public.transactions(user_id, status, date desc);


-- Verificación (solo lectura) -------------------------------------------------
-- El SQL Editor muestra solo el último resultado, por eso va todo en una tabla.
-- Tiene que decir security_invoker=true para la vista y search_path=public para
-- cada función.

select 'vista ' || relname as objeto, reloptions::text as config
from pg_class where relname = 'transactions_full'
union all
select 'funcion ' || p.proname, p.proconfig::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_month_summary', 'get_expenses_by_category', 'get_monthly_evolution',
                    'set_user_id_on_insert', 'handle_new_user', 'create_installments')
order by 1;
