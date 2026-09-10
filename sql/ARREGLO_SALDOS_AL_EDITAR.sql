-- ============================================================
-- ARREGLO: saldos de cuentas al editar movimientos
-- ============================================================
-- El trigger original recalculaba una sola cuenta:
-- COALESCE(OLD.account_id, NEW.account_id). Eso fallaba en dos casos:
--   1. Al editar un movimiento y cambiarle la cuenta, la cuenta NUEVA
--      no se recalculaba (quedaba con el saldo viejo).
--   2. En las transferencias, la cuenta DESTINO nunca se recalculaba.
-- Esta versión recalcula todas las cuentas que toca el movimiento,
-- antes y después del cambio. Se puede correr más de una vez sin problema.
-- ============================================================

CREATE OR REPLACE FUNCTION recalculate_account_balance()
RETURNS TRIGGER AS $$
DECLARE v_ids UUID[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_ids := ARRAY[NEW.account_id, NEW.transfer_to_account_id];
  ELSIF TG_OP = 'DELETE' THEN
    v_ids := ARRAY[OLD.account_id, OLD.transfer_to_account_id];
  ELSE
    v_ids := ARRAY[OLD.account_id, OLD.transfer_to_account_id,
                   NEW.account_id, NEW.transfer_to_account_id];
  END IF;

  UPDATE accounts a SET current_balance = a.initial_balance + COALESCE((
    SELECT SUM(CASE
      WHEN t.type = 'income'   AND t.account_id = a.id THEN t.amount
      WHEN t.type = 'expense'  AND t.account_id = a.id THEN -t.amount
      WHEN t.type = 'transfer' AND t.account_id = a.id THEN -t.amount
      WHEN t.type = 'transfer' AND t.transfer_to_account_id = a.id THEN t.amount
      ELSE 0 END)
    FROM transactions t
    WHERE (t.account_id = a.id OR t.transfer_to_account_id = a.id)
      AND t.status != 'cancelled' AND t.user_id = a.user_id), 0)
  WHERE a.id = ANY(v_ids);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recalcular una vez todas las cuentas, para corregir saldos que hayan
-- quedado desfasados por el problema de arriba.
UPDATE accounts a SET current_balance = a.initial_balance + COALESCE((
  SELECT SUM(CASE
    WHEN t.type = 'income'   AND t.account_id = a.id THEN t.amount
    WHEN t.type = 'expense'  AND t.account_id = a.id THEN -t.amount
    WHEN t.type = 'transfer' AND t.account_id = a.id THEN -t.amount
    WHEN t.type = 'transfer' AND t.transfer_to_account_id = a.id THEN t.amount
    ELSE 0 END)
  FROM transactions t
  WHERE (t.account_id = a.id OR t.transfer_to_account_id = a.id)
    AND t.status != 'cancelled' AND t.user_id = a.user_id), 0);
