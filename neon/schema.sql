-- ============================================================
-- Snuggle State: Nest — Neon Schema
-- Run this in the Neon SQL editor after creating your project
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE households (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  owner_id    UUID REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  full_name    TEXT,
  email        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE budgets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  category      TEXT NOT NULL,
  monthly_limit NUMERIC(10,2) NOT NULL CHECK (monthly_limit >= 0),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, category)
);

CREATE TABLE transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
  amount       NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  category     TEXT NOT NULL,
  date         DATE NOT NULL,
  merchant     TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bills (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  name         TEXT NOT NULL,
  amount       NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  due_day      SMALLINT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  frequency    TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'yearly')),
  category     TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bill_payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id      UUID REFERENCES bills(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  paid_date    DATE NOT NULL,
  amount       NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE savings_goals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id         UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  name                 TEXT NOT NULL,
  target_amount        NUMERIC(10,2) NOT NULL CHECK (target_amount > 0),
  current_amount       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date          DATE,
  monthly_contribution NUMERIC(10,2),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE savings_contributions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id      UUID REFERENCES savings_goals(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  amount       NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  date         DATE NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────

CREATE INDEX idx_transactions_household_date ON transactions(household_id, date DESC);
CREATE INDEX idx_transactions_household_category ON transactions(household_id, category);
CREATE INDEX idx_bills_household_active ON bills(household_id, is_active);
CREATE INDEX idx_savings_goals_household ON savings_goals(household_id);
CREATE INDEX idx_profiles_household ON profiles(household_id);

-- NOTE: Profile rows are created by the app in useAuth.jsx after sign-up.
-- Triggers on neon_auth."user" are not used as they can block user creation.

-- ─────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_household(household_name TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_household households%ROWTYPE;
  invite        TEXT;
  attempt       INT := 0;
  current_user_id UUID;
BEGIN
  current_user_id := (current_setting('neon_auth.user_id', true))::uuid;

  LOOP
    invite := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM households WHERE invite_code = invite);
    attempt := attempt + 1;
    IF attempt > 10 THEN RAISE EXCEPTION 'Could not generate unique invite code'; END IF;
  END LOOP;

  INSERT INTO households (name, invite_code, owner_id)
  VALUES (household_name, invite, current_user_id)
  RETURNING * INTO new_household;

  UPDATE profiles SET household_id = new_household.id WHERE id = current_user_id;

  RETURN row_to_json(new_household);
END;
$$;

CREATE OR REPLACE FUNCTION join_household_by_invite(invite_code_input TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  hh              households%ROWTYPE;
  current_user_id UUID;
BEGIN
  current_user_id := (current_setting('neon_auth.user_id', true))::uuid;

  SELECT * INTO hh FROM households WHERE invite_code = upper(trim(invite_code_input));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  UPDATE profiles SET household_id = hh.id WHERE id = current_user_id;

  RETURN json_build_object(
    'id',          hh.id,
    'name',        hh.name,
    'invite_code', hh.invite_code
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────

ALTER TABLE households         ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills              ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_payments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_contributions ENABLE ROW LEVEL SECURITY;

-- ── households ──────────────────────────────────────────────

CREATE POLICY "household_select" ON households FOR SELECT
  USING (
    id IN (SELECT household_id FROM profiles WHERE id = ((current_setting('neon_auth.user_id', true))::uuid))
    OR owner_id = ((current_setting('neon_auth.user_id', true))::uuid)
  );

CREATE POLICY "household_insert" ON households FOR INSERT
  WITH CHECK (owner_id = ((current_setting('neon_auth.user_id', true))::uuid));

CREATE POLICY "household_update" ON households FOR UPDATE
  USING (owner_id = ((current_setting('neon_auth.user_id', true))::uuid));

-- ── profiles ────────────────────────────────────────────────

CREATE POLICY "profile_select" ON profiles FOR SELECT
  USING (
    id = ((current_setting('neon_auth.user_id', true))::uuid)
    OR household_id IN (
      SELECT household_id FROM profiles
      WHERE id = ((current_setting('neon_auth.user_id', true))::uuid) AND household_id IS NOT NULL
    )
  );

CREATE POLICY "profile_insert" ON profiles FOR INSERT
  WITH CHECK (id = ((current_setting('neon_auth.user_id', true))::uuid));

CREATE POLICY "profile_update" ON profiles FOR UPDATE
  USING (id = ((current_setting('neon_auth.user_id', true))::uuid));

-- ── budgets ─────────────────────────────────────────────────

CREATE POLICY "budgets_all" ON budgets FOR ALL
  USING (household_id IN (SELECT household_id FROM profiles WHERE id = ((current_setting('neon_auth.user_id', true))::uuid)))
  WITH CHECK (household_id IN (SELECT household_id FROM profiles WHERE id = ((current_setting('neon_auth.user_id', true))::uuid)));

-- ── transactions ────────────────────────────────────────────

CREATE POLICY "transactions_all" ON transactions FOR ALL
  USING (household_id IN (SELECT household_id FROM profiles WHERE id = ((current_setting('neon_auth.user_id', true))::uuid)))
  WITH CHECK (household_id IN (SELECT household_id FROM profiles WHERE id = ((current_setting('neon_auth.user_id', true))::uuid)));

-- ── bills ───────────────────────────────────────────────────

CREATE POLICY "bills_all" ON bills FOR ALL
  USING (household_id IN (SELECT household_id FROM profiles WHERE id = ((current_setting('neon_auth.user_id', true))::uuid)))
  WITH CHECK (household_id IN (SELECT household_id FROM profiles WHERE id = ((current_setting('neon_auth.user_id', true))::uuid)));

-- ── bill_payments ───────────────────────────────────────────

CREATE POLICY "bill_payments_all" ON bill_payments FOR ALL
  USING (household_id IN (SELECT household_id FROM profiles WHERE id = ((current_setting('neon_auth.user_id', true))::uuid)))
  WITH CHECK (household_id IN (SELECT household_id FROM profiles WHERE id = ((current_setting('neon_auth.user_id', true))::uuid)));

-- ── savings_goals ───────────────────────────────────────────

CREATE POLICY "savings_goals_all" ON savings_goals FOR ALL
  USING (household_id IN (SELECT household_id FROM profiles WHERE id = ((current_setting('neon_auth.user_id', true))::uuid)))
  WITH CHECK (household_id IN (SELECT household_id FROM profiles WHERE id = ((current_setting('neon_auth.user_id', true))::uuid)));

-- ── savings_contributions ───────────────────────────────────

CREATE POLICY "savings_contributions_all" ON savings_contributions FOR ALL
  USING (household_id IN (SELECT household_id FROM profiles WHERE id = ((current_setting('neon_auth.user_id', true))::uuid)))
  WITH CHECK (household_id IN (SELECT household_id FROM profiles WHERE id = ((current_setting('neon_auth.user_id', true))::uuid)));
