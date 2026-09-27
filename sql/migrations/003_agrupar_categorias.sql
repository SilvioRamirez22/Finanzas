-- 003 · Agrupar categorías en madres con subcategorías (2026-09-27)
--
-- Se corre UNA vez en Supabase: SQL Editor → pegar todo → Run.
-- Es seguro correrlo de nuevo: lo que ya se movió deja de ser categoría raíz y
-- no se vuelve a tocar.
--
-- Qué hace, para cada categoría raíz de gastos de la lista de abajo:
--   1. La pone adentro de su madre (la crea si no existe, o la reactiva si
--      estaba desactivada). Si la madre ya tiene una subcategoría con ese
--      nombre, las une en una sola.
--   2. Sus subcategorías propias pasan a ser subcategorías de la madre (no hay
--      tres niveles); si la madre ya tiene una con el mismo nombre, se unen.
--   3. Todos sus movimientos pasan a "madre › subcategoría": los totales por
--      mes no cambian, solo dónde se agrupan.
--   4. Las copias que quedaron sin movimientos se desactivan (no se borran).
--
-- Freno: si alguna de las categorías que se mueven tiene un tope de
-- presupuesto cargado, no cambia NADA y avisa cuáles son (el tope habría que
-- pasarlo a mano a la madre desde Presupuesto).
--
-- Al final muestra el árbol de categorías de gastos con cuántos movimientos
-- tiene cada una, para revisar cómo quedó.

do $agrupar$
declare
  u uuid;
  fila record;
  cat record;
  sub record;
  p_id uuid;
  t_id uuid;
  y_id uuid;
  bloqueadas text;
begin
  -- categoría raíz → madre, y con qué nombre queda adentro
  create temp table _mapa (orden int, hija text, madre text, nombre text) on commit drop;
  insert into _mapa values
    (1,  'Comida',         'Alimentación', 'Comida'),
    (2,  'Pedidos Ya',     'Alimentación', 'Pedidos Ya'),
    (3,  'Comida trabajo', 'Alimentación', 'Comida trabajo'),
    (4,  'Luz',            'Servicios',    'Luz'),
    (5,  'Celular',        'Servicios',    'Celular'),
    (6,  'Expensas',       'Servicios',    'Expensas'),
    (7,  'Suscripciones',  'Servicios',    'Suscripciones'),
    (8,  'Compras bienes', 'Compras',      'Compras bienes'),
    (9,  'Ropa',           'Compras',      'Ropa'),
    (10, 'Ropa y calzado', 'Compras',      'Ropa'),
    (11, 'Fitness',        'Salud',        'Gym'),
    (12, 'Gym y deporte',  'Salud',        'Gym');

  -- subcategorías nuevas, vacías, para ir cargando
  create temp table _nuevas (madre text, nombre text, icono text) on commit drop;
  insert into _nuevas values ('Salud', 'Farmacia', 'pill');

  -- Freno: topes de presupuesto sobre las categorías que se van a mover.
  select string_agg(distinct c.name, ', ') into bloqueadas
  from budgets b
  join categories c on c.id = b.category_id
  join _mapa mp on lower(trim(c.name)) = lower(mp.hija)
  where c.parent_id is null and c.is_active and c.type <> 'income';
  if bloqueadas is not null then
    raise exception 'No se movió nada: % tiene(n) tope de presupuesto. Pasá esos topes a la madre desde Presupuesto (o borralos) y corré esto de nuevo.', bloqueadas;
  end if;

  for u in select distinct user_id from categories loop

    for fila in select * from _mapa order by orden loop
      for cat in
        select * from categories
        where user_id = u and parent_id is null and is_active and type <> 'income'
          and lower(trim(name)) = lower(fila.hija)
        order by created_at
      loop
        -- La madre: activa, o desactivada (se reactiva), o nueva.
        select id into p_id from categories
        where user_id = u and parent_id is null and is_active and type <> 'income'
          and lower(trim(name)) = lower(fila.madre) and id <> cat.id
        order by created_at limit 1;
        if p_id is null then
          select id into p_id from categories
          where user_id = u and parent_id is null and type <> 'income'
            and lower(trim(name)) = lower(fila.madre) and id <> cat.id
          order by created_at limit 1;
          if p_id is not null then
            update categories set is_active = true where id = p_id;
          else
            insert into categories (user_id, name, icon, color, type, sort_order)
            values (u, fila.madre, case fila.madre when 'Salud' then 'heart' else 'tag' end,
                    case fila.madre when 'Salud' then '#E24B4A' else '#888780' end, 'expense',
                    (select coalesce(max(sort_order), 0) + 1 from categories where user_id = u and parent_id is null))
            returning id into p_id;
          end if;
        end if;

        -- Las subcategorías propias de la que se mueve pasan a la madre.
        for sub in select * from categories where parent_id = cat.id and is_active loop
          select id into y_id from categories
          where parent_id = p_id and is_active and lower(trim(name)) = lower(trim(sub.name)) and id <> sub.id
          limit 1;
          if y_id is not null then
            update transactions set subcategory_id = y_id where subcategory_id = sub.id;
            update categories set is_active = false where id = sub.id;
          else
            update categories set parent_id = p_id where id = sub.id;
          end if;
        end loop;

        -- Adónde van sus movimientos: una subcategoría de la madre con ese
        -- nombre si ya existe; si no, esta misma categoría pasa a serlo.
        select id into t_id from categories
        where parent_id = p_id and is_active and lower(trim(name)) = lower(fila.nombre) and id <> cat.id
        limit 1;
        if t_id is null then
          update categories set parent_id = p_id, name = fila.nombre where id = cat.id;
          t_id := cat.id;
        end if;

        update transactions set subcategory_id = t_id
        where category_id = cat.id and (subcategory_id is null or subcategory_id = cat.id);
        update transactions set category_id = p_id where category_id = cat.id;

        if t_id <> cat.id then
          update categories set is_active = false where id = cat.id;
        end if;
      end loop;
    end loop;

    -- Subcategorías nuevas (solo si la madre existe para este usuario).
    for fila in select * from _nuevas loop
      select id into p_id from categories
      where user_id = u and parent_id is null and is_active and type <> 'income'
        and lower(trim(name)) = lower(fila.madre)
      order by created_at limit 1;
      continue when p_id is null;
      select id into y_id from categories
      where parent_id = p_id and lower(trim(name)) = lower(fila.nombre)
      order by is_active desc, created_at limit 1;
      if y_id is null then
        insert into categories (user_id, name, parent_id, icon, color, type, sort_order)
        select u, fila.nombre, p_id, fila.icono, color, 'expense',
               (select coalesce(max(sort_order), 0) + 1 from categories where parent_id = p_id)
        from categories where id = p_id;
      else
        update categories set is_active = true where id = y_id;
      end if;
    end loop;

  end loop;
end $agrupar$;


-- Cómo quedó (solo lectura): cada madre de gastos con sus subcategorías.
select coalesce(p.name, c.name)                         as madre,
       case when c.parent_id is null then '—' else c.name end as subcategoria,
       (select count(*) from transactions t
         where t.status <> 'cancelled'
           and (case when c.parent_id is null
                     then t.category_id = c.id and t.subcategory_id is null
                     else t.subcategory_id = c.id end)) as movimientos
from categories c
left join categories p on p.id = c.parent_id
where c.is_active and c.type <> 'income' and (p.id is null or p.is_active)
order by madre, c.parent_id is not null, subcategoria;
