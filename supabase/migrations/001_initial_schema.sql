-- ============================================================
-- Snuggle State: Nest — Initial Schema
-- Run this in the Supabase SQL editor or via supabase db push
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE households (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  owner_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  full_name    TEXT,
  email        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE budgets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id  UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  category      TEXT NOT NULL,
  monthly_limit NUMERIC(10,2) NOT NULL CHECK (monthly_limit >= 0),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, category)
);

CREATE TABLE transactions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount       NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  category     TEXT NOT NULL,
  date         DATE NOT NULL,
  merchant     TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bills (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id      UUID REFERENCES bills(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  paid_date    DATE NOT NULL,
  amount       NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE savings_goals (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id         UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  name                 TEXT NOT NULL,
  target_amount        NUMERIC(10,2) NOT NULL CHECK (target_amount > 0),
  current_amount       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date          DATE,
  monthly_contribution NUMERIC(10,2),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE savings_contributions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ─────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────

-- Auto-create profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create a household and assign the creator as owner
CREATE OR REPLACE FUNCTION create_household(household_name TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_household households%ROWTYPE;
  invite        TEXT;
  attempt       INT := 0;
BEGIN
  -- Generate a unique 6-char uppercase invite code
  LOOP
    invite := upper(substring(encode(gen_random_bytes(4), 'hex'), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM households WHERE invite_code = invite);
    attempt := attempt + 1;
    IF attempt > 10 THEN RAISE EXCEPTION 'Could not generate unique invite code'; END IF;
  END LOOP;

  INSERT INTO households (name, invite_code, owner_id)
  VALUES (household_name, invite, auth.uid())
  RETURNING * INTO new_household;

  UPDATE profiles SET household_id = new_household.id WHERE id = auth.uid();

  RETURN row_to_json(new_household);
END;
$$;

-- Join a household by invite code
CREATE OR REPLACE FUNCTION join_household_by_invite(invite_code_input TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  hh households%ROWTYPE;
BEGIN
  SELECT * INTO hh FROM households WHERE invite_code = upper(trim(invite_code_input));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  -- Check user is not already in a household
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND household_id IS NOT NULL) THEN
    -- Allow re-joining (update to new household)
    NULL;
  END IF;

  UPDATE profiles SET household_id = hh.id WHERE id = auth.uid();

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
    id IN (SELECT household_id FROM profiles WHERE id = auth.uid())
    OR owner_id = auth.uid()
  );

CREATE POLICY "household_insert" ON households FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "household_update" ON households FOR UPDATE
  USING (owner_id = auth.uid());

-- ── profiles ────────────────────────────────────────────────

CREATE POLICY "profile_select" ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid() AND household_id IS NOT NULL)
  );

CREATE POLICY "profile_insert" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profile_update" ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ── budgets ─────────────────────────────────────────────────

CREATE POLICY "budgets_all" ON budgets FOR ALL
  USING (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()));

-- ── transactions ────────────────────────────────────────────

CREATE POLICY "transactions_all" ON transactions FOR ALL
  USING (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()));

-- ── bills ───────────────────────────────────────────────────

CREATE POLICY "bills_all" ON bills FOR ALL
  USING (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()));

-- ── bill_payments ───────────────────────────────────────────

CREATE POLICY "bill_payments_all" ON bill_payments FOR ALL
  USING (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()));

-- ── savings_goals ───────────────────────────────────────────

CREATE POLICY "savings_goals_all" ON savings_goals FOR ALL
  USING (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()));

-- ── savings_contributions ───────────────────────────────────

CREATE POLICY "savings_contributions_all" ON savings_contributions FOR ALL
  USING (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()));
