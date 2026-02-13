-- ============================================================
-- Initial schema for Festivalportalen
-- ============================================================

-- Enum-like types (using check constraints instead of pg enums for flexibility)

CREATE TABLE festivals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  start_date date,
  end_date date,
  location text,
  capacity integer,
  website text,
  default_locale text NOT NULL DEFAULT 'nb',
  currency text NOT NULL DEFAULT 'NOK',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  festival_id uuid NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'crew'
    CHECK (role IN ('admin', 'board', 'crew', 'sponsor', 'accountant')),
  full_name text,
  email text,
  locale text,
  has_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ticket_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  ticketco_id text,
  ticket_type text NOT NULL,
  category text CHECK (category IN ('ticket', 'fb')),
  quantity integer NOT NULL DEFAULT 0,
  price_ex_vat numeric,
  vat_rate numeric,
  vat_amount numeric,
  price_inc_vat numeric,
  sale_channel text CHECK (sale_channel IN ('web', 'pos')),
  sold_at timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  name text NOT NULL,
  level text CHECK (level IN ('hovedsponsor', 'gull', 'sølv', 'bronse', 'partner')),
  contact_name text,
  contact_email text,
  contact_phone text,
  invoice_address text,
  logo_url text,
  agreement_amount numeric,
  status text NOT NULL DEFAULT 'contacted'
    CHECK (status IN ('contacted', 'agreed', 'signed', 'delivered', 'invoiced')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sponsor_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  festival_id uuid NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  description text NOT NULL,
  delivered boolean NOT NULL DEFAULT false,
  delivered_at timestamptz,
  documentation_url text
);

CREATE TABLE income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text,
  amount_ex_vat numeric,
  vat_rate numeric,
  vat_amount numeric,
  source text,
  is_budget boolean NOT NULL DEFAULT false,
  date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text,
  amount_ex_vat numeric,
  vat_rate numeric,
  vat_amount numeric,
  supplier text,
  is_budget boolean NOT NULL DEFAULT false,
  date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE festival_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  ticketco_api_key text,
  ticketco_event_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ticketco_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  synced_at timestamptz NOT NULL DEFAULT now(),
  records_synced integer,
  status text NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'error')),
  error_message text
);

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  type text NOT NULL
    CHECK (type IN ('sponsor_report', 'annual_report', 'accounting_report')),
  title text,
  data jsonb,
  pdf_url text,
  created_by uuid REFERENCES auth.users(id),
  sent_to text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE festivals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE festival_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticketco_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());

-- Users can read their festival
CREATE POLICY "Users can read own festival"
  ON festivals FOR SELECT
  USING (
    id IN (SELECT festival_id FROM user_profiles WHERE id = auth.uid())
  );

-- Festival members can read all data for their festival
CREATE POLICY "Festival members can read ticket_sales"
  ON ticket_sales FOR SELECT
  USING (
    festival_id IN (SELECT festival_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Festival members can read sponsors"
  ON sponsors FOR SELECT
  USING (
    festival_id IN (SELECT festival_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Festival members can read sponsor_deliverables"
  ON sponsor_deliverables FOR SELECT
  USING (
    festival_id IN (SELECT festival_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Festival members can read income"
  ON income FOR SELECT
  USING (
    festival_id IN (SELECT festival_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Festival members can read expenses"
  ON expenses FOR SELECT
  USING (
    festival_id IN (SELECT festival_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Festival members can read festival_integrations"
  ON festival_integrations FOR SELECT
  USING (
    festival_id IN (SELECT festival_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Festival members can read ticketco_sync_logs"
  ON ticketco_sync_logs FOR SELECT
  USING (
    festival_id IN (SELECT festival_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Festival members can read reports"
  ON reports FOR SELECT
  USING (
    festival_id IN (SELECT festival_id FROM user_profiles WHERE id = auth.uid())
  );

-- Admins can write to all festival tables
CREATE POLICY "Admins can manage festivals"
  ON festivals FOR ALL
  USING (
    id IN (
      SELECT festival_id FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage sponsors"
  ON sponsors FOR ALL
  USING (
    festival_id IN (
      SELECT festival_id FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage sponsor_deliverables"
  ON sponsor_deliverables FOR ALL
  USING (
    festival_id IN (
      SELECT festival_id FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage income"
  ON income FOR ALL
  USING (
    festival_id IN (
      SELECT festival_id FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage expenses"
  ON expenses FOR ALL
  USING (
    festival_id IN (
      SELECT festival_id FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage festival_integrations"
  ON festival_integrations FOR ALL
  USING (
    festival_id IN (
      SELECT festival_id FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage reports"
  ON reports FOR ALL
  USING (
    festival_id IN (
      SELECT festival_id FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Indexes for common queries
CREATE INDEX idx_user_profiles_festival ON user_profiles(festival_id);
CREATE INDEX idx_ticket_sales_festival ON ticket_sales(festival_id);
CREATE INDEX idx_sponsors_festival ON sponsors(festival_id);
CREATE INDEX idx_income_festival ON income(festival_id);
CREATE INDEX idx_expenses_festival ON expenses(festival_id);
