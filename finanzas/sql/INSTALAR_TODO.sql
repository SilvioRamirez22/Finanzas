-- ============================================================
-- FINANZAS PERSONALES — INSTALACIÓN COMPLETA EN UN SOLO ARCHIVO
-- ============================================================
-- Pegá TODO este archivo en el SQL Editor de Supabase y ejecutalo
-- una sola vez. Crea todo: tablas, seguridad, funciones, y carga
-- automática de categorías al registrarte (sin pasos manuales).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLAS
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  currency TEXT NOT NULL DEFAULT 'ARS',
  locale TEXT NOT NULL DEFAULT 'es-AR',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cash','debit_card','credit_card','transfer','digital_wallet','other')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cash','bank','digital_wallet','credit_card','investment','savings','other')),
  currency TEXT NOT NULL DEFAULT 'ARS',
  initial_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit_limit NUMERIC(14,2),
  closing_day INTEGER CHECK (closing_day BETWEEN 1 AND 31),
  due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
  color TEXT NOT NULL DEFAULT '#1D9E75',
  icon TEXT NOT NULL DEFAULT 'wallet',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  exclude_from_totals BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  icon TEXT NOT NULL DEFAULT 'tag',
  color TEXT NOT NULL DEFAULT '#7F77DD',
  type TEXT NOT NULL CHECK (type IN ('expense','income','both')) DEFAULT 'both',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly','yearly')),
  start_date DATE NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE),
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, category_id, start_date)
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id),
  category_id UUID REFERENCES categories(id),
  subcategory_id UUID REFERENCES categories(id),
  payment_method_id UUID REFERENCES payment_methods(id),
  type TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  notes TEXT,
  installments_total INTEGER NOT NULL DEFAULT 1 CHECK (installments_total >= 1),
  installment_number INTEGER NOT NULL DEFAULT 1,
  parent_transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  transfer_to_account_id UUID REFERENCES accounts(id),
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_rule TEXT,
  recurrence_end_date DATE,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','pending','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE investments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id),
  ticker TEXT NOT NULL,
  name TEXT,
  type TEXT NOT NULL CHECK (type IN ('stock','cedear','mutual_fund','crypto','bond','other')),
  quantity NUMERIC(18,8) NOT NULL,
  buy_price NUMERIC(14,4) NOT NULL,
  buy_date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_price NUMERIC(14,4),
  current_price_updated_at TIMESTAMPTZ,
  currency TEXT NOT NULL DEFAULT 'ARS',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE investment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('buy','sell','dividend')),
  quantity NUMERIC(18,8) NOT NULL,
  price NUMERIC(14,4) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE month_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  total_income NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_expenses NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  balances_by_account JSONB NOT NULL DEFAULT '{}',
  expenses_by_category JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_parent ON transactions(parent_transaction_id);
CREATE INDEX idx_investments_user ON investments(user_id);
CREATE INDEX idx_categories_user ON categories(user_id, parent_id);

-- ============================================================
-- SEGURIDAD (cada usuario ve solo sus datos)
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE month_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','categories','payment_methods','budgets','transactions','investments','investment_transactions','month_snapshots']
  LOOP
    EXECUTE format('CREATE POLICY "user_own_%s" ON %s FOR ALL USING (user_id = auth.uid())', t, t);
  END LOOP;
END $$;

CREATE POLICY "user_own_profiles" ON profiles FOR ALL USING (id = auth.uid());

-- ============================================================
-- TRIGGERS: updated_at + balance automático
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_transactions_updated BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_investments_updated BEFORE UPDATE ON investments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION recalculate_account_balance()
RETURNS TRIGGER AS $$
DECLARE v_account_id UUID;
BEGIN
  v_account_id := COALESCE(OLD.account_id, NEW.account_id);
  UPDATE accounts SET current_balance = (
    SELECT initial_balance + COALESCE(SUM(
      CASE
        WHEN type = 'income' THEN amount
        WHEN type = 'expense' THEN -amount
        WHEN type = 'transfer' AND account_id = v_account_id THEN -amount
        WHEN type = 'transfer' AND transfer_to_account_id = v_account_id THEN amount
        ELSE 0
      END), 0)
    FROM transactions
    WHERE (account_id = v_account_id OR transfer_to_account_id = v_account_id)
      AND status != 'cancelled' AND user_id = accounts.user_id)
  WHERE id = v_account_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_balance_insert AFTER INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION recalculate_account_balance();
CREATE TRIGGER trg_balance_update AFTER UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION recalculate_account_balance();
CREATE TRIGGER trg_balance_delete AFTER DELETE ON transactions FOR EACH ROW EXECUTE FUNCTION recalculate_account_balance();

-- ============================================================
-- VISTA Y FUNCIONES DE CONSULTA
-- ============================================================
CREATE OR REPLACE VIEW transactions_full AS
SELECT t.*,
  a.name AS account_name, a.color AS account_color, a.icon AS account_icon, a.type AS account_type,
  c.name AS category_name, c.color AS category_color, c.icon AS category_icon,
  sc.name AS subcategory_name,
  pm.name AS payment_method_name, pm.type AS payment_method_type,
  ta.name AS transfer_to_account_name
FROM transactions t
LEFT JOIN accounts a ON t.account_id = a.id
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN categories sc ON t.subcategory_id = sc.id
LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
LEFT JOIN accounts ta ON t.transfer_to_account_id = ta.id;

CREATE OR REPLACE FUNCTION get_month_summary(p_user_id UUID, p_year INT, p_month INT)
RETURNS TABLE(total_income NUMERIC, total_expenses NUMERIC, net_balance NUMERIC, transaction_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount WHEN type = 'expense' THEN -amount ELSE 0 END), 0),
    COUNT(*)
  FROM transactions
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year AND EXTRACT(MONTH FROM date) = p_month
    AND status != 'cancelled';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_expenses_by_category(p_user_id UUID, p_start_date DATE, p_end_date DATE)
RETURNS TABLE(category_id UUID, category_name TEXT, category_color TEXT, category_icon TEXT,
  total NUMERIC, transaction_count BIGINT, budget_amount NUMERIC, budget_percentage NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name, c.color, c.icon,
    COALESCE(SUM(t.amount), 0), COUNT(t.id), b.amount,
    CASE WHEN b.amount > 0 THEN ROUND((COALESCE(SUM(t.amount), 0) / b.amount) * 100, 1) ELSE NULL END
  FROM categories c
  LEFT JOIN transactions t ON t.category_id = c.id AND t.user_id = p_user_id
    AND t.date BETWEEN p_start_date AND p_end_date AND t.type = 'expense' AND t.status != 'cancelled'
  LEFT JOIN budgets b ON b.category_id = c.id AND b.user_id = p_user_id AND b.is_active = TRUE
  WHERE c.user_id = p_user_id AND c.parent_id IS NULL AND c.type IN ('expense', 'both')
  GROUP BY c.id, c.name, c.color, c.icon, b.amount
  ORDER BY 5 DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_monthly_evolution(p_user_id UUID, p_months INT DEFAULT 12)
RETURNS TABLE(year INT, month INT, month_label TEXT, total_income NUMERIC, total_expenses NUMERIC, net_balance NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT EXTRACT(YEAR FROM date)::INT, EXTRACT(MONTH FROM date)::INT, TO_CHAR(date, 'Mon YYYY'),
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount WHEN type = 'expense' THEN -amount ELSE 0 END), 0)
  FROM transactions
  WHERE user_id = p_user_id
    AND date >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month' * (p_months - 1)
    AND status != 'cancelled'
  GROUP BY EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date), TO_CHAR(date, 'Mon YYYY')
  ORDER BY 1, 2;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_installments(
  p_user_id UUID, p_account_id UUID, p_category_id UUID, p_subcategory_id UUID,
  p_payment_method_id UUID, p_description TEXT, p_total_amount NUMERIC,
  p_installments INT, p_start_date DATE, p_notes TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE v_installment_amount NUMERIC; v_parent_id UUID; i INT;
BEGIN
  v_installment_amount := ROUND(p_total_amount / p_installments, 2);
  INSERT INTO transactions (user_id, account_id, category_id, subcategory_id, payment_method_id,
    type, amount, date, description, notes, installments_total, installment_number, status)
  VALUES (p_user_id, p_account_id, p_category_id, p_subcategory_id, p_payment_method_id,
    'expense', v_installment_amount, p_start_date, p_description || ' (1/' || p_installments || ')',
    p_notes, p_installments, 1, 'confirmed')
  RETURNING id INTO v_parent_id;
  FOR i IN 2..p_installments LOOP
    INSERT INTO transactions (user_id, account_id, category_id, subcategory_id, payment_method_id,
      type, amount, date, description, notes, installments_total, installment_number, parent_transaction_id, status)
    VALUES (p_user_id, p_account_id, p_category_id, p_subcategory_id, p_payment_method_id,
      'expense', v_installment_amount, (p_start_date + INTERVAL '1 month' * (i - 1))::DATE,
      p_description || ' (' || i || '/' || p_installments || ')',
      p_notes, p_installments, i, v_parent_id, 'pending');
  END LOOP;
  RETURN v_parent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- CARGA AUTOMÁTICA AL REGISTRARSE
-- Crea perfil + categorías + cuentas + medios de pago.
-- NO necesitás hacer ningún paso manual después de registrarte.
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  uid UUID := NEW.id;
  cat_alim UUID; cat_trans UUID; cat_viv UUID; cat_serv UUID;
BEGIN
  -- Perfil
  INSERT INTO profiles (id, email, full_name)
  VALUES (uid, NEW.email, NEW.raw_user_meta_data->>'full_name');

  -- Categorías de gasto principales
  INSERT INTO categories (user_id, name, icon, color, type, sort_order) VALUES
    (uid, 'Alimentación', 'shopping-cart', '#1D9E75', 'expense', 1) RETURNING id INTO cat_alim;
  INSERT INTO categories (user_id, name, icon, color, type, sort_order) VALUES
    (uid, 'Transporte', 'car', '#378ADD', 'expense', 2) RETURNING id INTO cat_trans;
  INSERT INTO categories (user_id, name, icon, color, type, sort_order) VALUES
    (uid, 'Vivienda', 'home', '#D85A30', 'expense', 3) RETURNING id INTO cat_viv;
  INSERT INTO categories (user_id, name, icon, color, type, sort_order) VALUES
    (uid, 'Servicios', 'bolt', '#888780', 'expense', 4) RETURNING id INTO cat_serv;
  INSERT INTO categories (user_id, name, icon, color, type, sort_order) VALUES
    (uid, 'Salud', 'heart', '#E24B4A', 'expense', 5),
    (uid, 'Educación', 'school', '#534AB7', 'expense', 6),
    (uid, 'Ocio y entretenimiento', 'device-gamepad', '#BA7517', 'expense', 7),
    (uid, 'Ropa y calzado', 'shirt', '#D4537E', 'expense', 8),
    (uid, 'Gym y deporte', 'barbell', '#5DCAA5', 'expense', 9),
    (uid, 'Otros gastos', 'dots', '#888780', 'expense', 10);

  -- Subcategorías
  INSERT INTO categories (user_id, name, parent_id, icon, color, type, sort_order) VALUES
    (uid, 'Supermercado', cat_alim, 'building-store', '#1D9E75', 'expense', 1),
    (uid, 'Restaurante', cat_alim, 'tools-kitchen-2', '#1D9E75', 'expense', 2),
    (uid, 'Delivery', cat_alim, 'motorbike', '#1D9E75', 'expense', 3),
    (uid, 'Combustible', cat_trans, 'gas-station', '#378ADD', 'expense', 1),
    (uid, 'Transporte público', cat_trans, 'bus', '#378ADD', 'expense', 2),
    (uid, 'Taxi / Uber', cat_trans, 'taxi', '#378ADD', 'expense', 3),
    (uid, 'Alquiler', cat_viv, 'home', '#D85A30', 'expense', 1),
    (uid, 'Expensas', cat_viv, 'building', '#D85A30', 'expense', 2),
    (uid, 'Luz', cat_serv, 'bulb', '#888780', 'expense', 1),
    (uid, 'Gas', cat_serv, 'flame', '#888780', 'expense', 2),
    (uid, 'Internet', cat_serv, 'wifi', '#888780', 'expense', 3),
    (uid, 'Celular', cat_serv, 'device-mobile', '#888780', 'expense', 4),
    (uid, 'Streaming', cat_serv, 'player-play', '#888780', 'expense', 5);

  -- Categorías de ingreso
  INSERT INTO categories (user_id, name, icon, color, type, sort_order) VALUES
    (uid, 'Sueldo', 'briefcase', '#1D9E75', 'income', 1),
    (uid, 'Freelance', 'device-laptop', '#1D9E75', 'income', 2),
    (uid, 'Inversiones', 'trending-up', '#1D9E75', 'income', 3),
    (uid, 'Otros ingresos', 'cash', '#1D9E75', 'income', 4);

  -- Medios de pago
  INSERT INTO payment_methods (user_id, name, type, sort_order) VALUES
    (uid, 'Efectivo', 'cash', 1),
    (uid, 'Débito', 'debit_card', 2),
    (uid, 'Crédito', 'credit_card', 3),
    (uid, 'Mercado Pago', 'digital_wallet', 4),
    (uid, 'Transferencia', 'transfer', 5);

  -- Cuentas iniciales
  INSERT INTO accounts (user_id, name, type, color, icon, sort_order) VALUES
    (uid, 'Efectivo', 'cash', '#1D9E75', 'cash', 1),
    (uid, 'Cuenta bancaria', 'bank', '#378ADD', 'bank', 2),
    (uid, 'Mercado Pago', 'digital_wallet', '#1CCDFF', 'wallet', 3);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ¡LISTO! Cuando te registres en la app, todo se carga solo.
-- ============================================================
