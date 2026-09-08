-- ============================================================
-- FIXES PARA LA BASE EXISTENTE
-- ============================================================
-- Estado verificado el 2026-09-07 sobre el proyecto wkerkhekdapwvmqtzurd.
--
-- CORRELO POR BLOQUES, NO TODO DE UNA. Cada bloque es independiente.
-- Los bloques 1 a 4 son seguros. El 5 y el 6 MODIFICAN TUS DATOS:
-- leé la parte de diagnóstico antes de correr la de escritura.
--
-- Antes de empezar, hacé un backup:
--   Supabase → Database → Backups → Download / Point in time
-- ============================================================


-- ============================================================
-- BLOQUE 1 — Cerrar el bypass de RLS en transactions_full  [SEGURO]
-- ============================================================
-- La vista es propiedad de postgres y no declara security_invoker,
-- así que corre con los permisos del dueño y se saltea el RLS de
-- transactions. Hoy no te expone nada (sos el único usuario), pero
-- si algún día compartís la app, cualquier usuario logueado podría
-- leer los movimientos de todos.

ALTER VIEW transactions_full SET (security_invoker = true);

-- Verificación: reloptions debe mostrar {security_invoker=true}
SELECT relname, reloptions FROM pg_class WHERE relname = 'transactions_full';


-- ============================================================
-- BLOQUE 2 — Transferencias: actualizar la cuenta destino  [SEGURO]
-- ============================================================
-- El trigger actual solo recalcula COALESCE(OLD.account_id, NEW.account_id),
-- o sea la cuenta ORIGEN. La cuenta a la que transferís queda con el
-- saldo viejo. Hoy es latente: no tenés ninguna transferencia cargada.

CREATE OR REPLACE FUNCTION recalculate_account_balance()
RETURNS TRIGGER AS $fn$
DECLARE v_id UUID;
BEGIN
  FOREACH v_id IN ARRAY ARRAY[
    CASE WHEN TG_OP <> 'INSERT' THEN OLD.account_id END,
    CASE WHEN TG_OP <> 'INSERT' THEN OLD.transfer_to_account_id END,
    CASE WHEN TG_OP <> 'DELETE' THEN NEW.account_id END,
    CASE WHEN TG_OP <> 'DELETE' THEN NEW.transfer_to_account_id END]
  LOOP
    CONTINUE WHEN v_id IS NULL;
    UPDATE accounts a SET current_balance = a.initial_balance + COALESCE((
      SELECT SUM(CASE
        WHEN t.type = 'income'  THEN t.amount
        WHEN t.type = 'expense' THEN -t.amount
        WHEN t.type = 'transfer' AND t.account_id = a.id THEN -t.amount
        WHEN t.type = 'transfer' AND t.transfer_to_account_id = a.id THEN t.amount
        ELSE 0 END)
      FROM transactions t
      WHERE (t.account_id = a.id OR t.transfer_to_account_id = a.id)
        AND t.status <> 'cancelled' AND t.user_id = a.user_id), 0)
    WHERE a.id = v_id;
  END LOOP;
  RETURN NULL;
END;
$fn$ LANGUAGE plpgsql;

-- Recalculo puntual de todas las cuentas, por si quedó alguna desfasada.
-- (Al 2026-09-07 las 6 cuentas coincidían, así que esto no debería cambiar nada.)
UPDATE accounts a SET current_balance = a.initial_balance + COALESCE((
  SELECT SUM(CASE
    WHEN t.type = 'income'  THEN t.amount
    WHEN t.type = 'expense' THEN -t.amount
    WHEN t.type = 'transfer' AND t.account_id = a.id THEN -t.amount
    WHEN t.type = 'transfer' AND t.transfer_to_account_id = a.id THEN t.amount
    ELSE 0 END)
  FROM transactions t
  WHERE (t.account_id = a.id OR t.transfer_to_account_id = a.id)
    AND t.status <> 'cancelled' AND t.user_id = a.user_id), 0);


-- ============================================================
-- BLOQUE 3 — trigger de user_id en las 2 tablas que faltan  [SEGURO]
-- ============================================================
-- trg_set_user_id existe en accounts, budgets, categories, investments,
-- payment_methods y transactions, pero NO en investment_transactions
-- ni en month_snapshots. Si algún día la app escribe ahí, va a fallar.

CREATE TRIGGER trg_set_user_id BEFORE INSERT ON investment_transactions
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

CREATE TRIGGER trg_set_user_id BEFORE INSERT ON month_snapshots
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================================
-- BLOQUE 4 — search_path fijo en las funciones SECURITY DEFINER  [SEGURO]
-- ============================================================
-- Ninguna de las funciones SECURITY DEFINER fija search_path. Es el
-- warning clásico del linter de Supabase: una función con permisos
-- elevados que resuelve nombres de tabla según el search_path del que
-- la llama. ALTER FUNCTION lo arregla sin tocar el cuerpo.

ALTER FUNCTION get_month_summary(INT, INT)                SET search_path = public;
ALTER FUNCTION get_expenses_by_category(DATE, DATE)       SET search_path = public;
ALTER FUNCTION get_monthly_evolution(INT)                 SET search_path = public;
ALTER FUNCTION set_user_id_on_insert()                    SET search_path = public;
ALTER FUNCTION handle_new_user()                          SET search_path = public;
ALTER FUNCTION create_installments(UUID, UUID, UUID, UUID, UUID, TEXT, NUMERIC, INT, DATE, TEXT)
                                                          SET search_path = public;

-- Índice que hoy no existe y que usa casi toda consulta de la app:
CREATE INDEX IF NOT EXISTS idx_transactions_user_status_date
  ON transactions(user_id, status, date DESC);


-- ============================================================
-- BLOQUE 5 — Categorías duplicadas  [MODIFICA DATOS]
-- ============================================================
-- Duplicadas por nombre: Celular, Expensas, Luz.
-- Además hay solapamientos por sinónimo que este script NO toca
-- porque son decisión tuya:
--   Ropa (63 movs) vs Ropa y calzado (5 movs)
--   Fitness (13 movs) vs Gym y deporte (1 mov)
--   Comida (138) vs Comida trabajo (4) vs Pedidos Ya (42)

-- 5a. DIAGNÓSTICO — mirá esto primero, no escribe nada.
SELECT c.id, c.name, c.parent_id, c.is_active, c.created_at,
       (SELECT count(*) FROM transactions t
         WHERE t.category_id = c.id OR t.subcategory_id = c.id) AS movimientos
FROM categories c
WHERE c.name IN ('Celular','Expensas','Luz')
ORDER BY c.name, movimientos DESC;

-- 5b. ESCRITURA — repunta todo a la copia más usada y desactiva la otra.
-- Conserva la categoría con más movimientos; ante empate, la más vieja.
WITH ranked AS (
  SELECT c.id, c.name,
         row_number() OVER (
           PARTITION BY c.user_id, c.name, coalesce(c.parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
           ORDER BY (SELECT count(*) FROM transactions t
                      WHERE t.category_id = c.id OR t.subcategory_id = c.id) DESC,
                    c.created_at ASC) AS rn,
         first_value(c.id) OVER (
           PARTITION BY c.user_id, c.name, coalesce(c.parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
           ORDER BY (SELECT count(*) FROM transactions t
                      WHERE t.category_id = c.id OR t.subcategory_id = c.id) DESC,
                    c.created_at ASC) AS keeper_id
  FROM categories c
  WHERE c.name IN ('Celular','Expensas','Luz')
), dupes AS (
  SELECT id AS dupe_id, keeper_id FROM ranked WHERE rn > 1
)
UPDATE transactions t SET category_id = d.keeper_id
FROM dupes d WHERE t.category_id = d.dupe_id;

-- Ojo: repetir el mismo WITH para subcategory_id, parent_id y budgets.
-- Se hace en pasos separados a propósito, para que puedas revisar
-- el resultado de cada uno antes de seguir.

-- (Corré el bloque 5a de nuevo para confirmar que la duplicada
--  quedó en 0 movimientos, y recién ahí desactivala:)
-- UPDATE categories SET is_active = FALSE WHERE id = '<id-de-la-duplicada>';


-- ============================================================
-- BLOQUE 6 — Saldos iniciales reales  [MODIFICA DATOS]
-- ============================================================
-- Las 6 cuentas tienen initial_balance = 0, así que current_balance no
-- es plata: es el acumulado de lo que cargaste. Por eso Efectivo da
-- -10.800.323,93.
--
-- Poné acá el saldo REAL que tenía cada cuenta el día que empezaste a
-- cargar (29-10-2024). Para las tarjetas de crédito, el saldo suele ir
-- en negativo (deuda). Reemplazá los ceros y descomentá.

-- UPDATE accounts SET initial_balance = 0 WHERE name = 'Efectivo';
-- UPDATE accounts SET initial_balance = 0 WHERE name = 'Cuenta bancaria';
-- UPDATE accounts SET initial_balance = 0 WHERE name = 'Mercado Pago';
-- UPDATE accounts SET initial_balance = 0 WHERE name = 'BBVA';
-- UPDATE accounts SET initial_balance = 0 WHERE name = 'Santander';
-- UPDATE accounts SET initial_balance = 0 WHERE name = 'Galicia';

-- Después de tocar initial_balance, recalculá los saldos con el
-- UPDATE del final del bloque 2.

-- Nota aparte: Galicia es type = 'credit_card' y da saldo POSITIVO
-- (+1.042.928). Suele ser síntoma de pagos de tarjeta cargados como
-- 'income' en esa cuenta en vez de como transferencia desde el banco.
-- Para revisarlos:
SELECT t.date, t.description, t.amount, t.type
FROM transactions t JOIN accounts a ON a.id = t.account_id
WHERE a.name = 'Galicia' AND t.type = 'income'
ORDER BY t.date DESC;
