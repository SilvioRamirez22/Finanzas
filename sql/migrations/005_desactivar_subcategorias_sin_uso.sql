-- 005 · Desactivar subcategorías del alta que no se usan (2026-09-27)
--
-- Se corre UNA vez en Supabase, después de la 003: SQL Editor → pegar todo → Run.
-- Es seguro correrlo de nuevo.
--
-- Estas seis venían con la cuenta y tenían 0 movimientos al 2026-09-27; en la
-- carga aparecían como opciones sin uso. Se desactivan (no se borran: se
-- reactivan desde la base si hace falta). Una que para entonces ya tenga algún
-- movimiento NO se toca.

with sin_uso (madre, sub) as (values
  ('alimentación', 'delivery'),
  ('alimentación', 'restaurante'),
  ('alimentación', 'supermercado'),
  ('servicios',    'gas'),
  ('servicios',    'internet'),
  ('servicios',    'streaming')
)
update categories c
set is_active = false
from categories p, sin_uso s
where p.id = c.parent_id
  and lower(trim(p.name)) = s.madre
  and lower(trim(c.name)) = s.sub
  and c.is_active
  and not exists (
    select 1 from transactions t
    where t.subcategory_id = c.id or t.category_id = c.id
  );


-- Cómo quedó (solo lectura): las subcategorías de Alimentación y Servicios.
select p.name as madre, c.name as subcategoria,
       case when c.is_active then 'activa' else 'desactivada' end as estado,
       (select count(*) from transactions t where t.subcategory_id = c.id) as movimientos
from categories c
join categories p on p.id = c.parent_id
where lower(trim(p.name)) in ('alimentación', 'servicios') and p.is_active
order by p.name, c.is_active desc, c.name;
