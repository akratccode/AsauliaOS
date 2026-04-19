-- 0008_finance_region_split
-- Splits all financial flows into two regions: US (USD, Stripe) and CO
-- (COP, manual). Adds a per-month finance_periods table used for the
-- monthly close / P&L workflow. All existing rows are backfilled as 'us'.

DO $$ BEGIN
  CREATE TYPE finance_region AS ENUM ('us', 'co');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE brand_payment_method AS ENUM ('stripe_subscription', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE finance_period_status AS ENUM ('open', 'closed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS finance_region finance_region NOT NULL DEFAULT 'us',
  ADD COLUMN IF NOT EXISTS payment_method brand_payment_method NOT NULL DEFAULT 'stripe_subscription',
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'USD';

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS finance_region finance_region NOT NULL DEFAULT 'us';

ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS finance_region finance_region NOT NULL DEFAULT 'us';

ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS finance_region finance_region NOT NULL DEFAULT 'us';

ALTER TABLE contractor_bonuses
  ADD COLUMN IF NOT EXISTS finance_region finance_region NOT NULL DEFAULT 'us';

CREATE TABLE IF NOT EXISTS finance_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finance_region finance_region NOT NULL,
  currency CHAR(3) NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  status finance_period_status NOT NULL DEFAULT 'open',
  revenue_cents bigint NOT NULL DEFAULT 0,
  payouts_cents bigint NOT NULL DEFAULT 0,
  bonuses_cents bigint NOT NULL DEFAULT 0,
  net_cents bigint NOT NULL DEFAULT 0,
  closed_at timestamptz,
  closed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_periods_region_year_month_unique
  ON finance_periods (finance_region, year, month);

-- Relax the plan amount check constraints so COP-denominated plans (which
-- typically run in the hundreds of thousands of cents) are allowed. Range
-- validation is now done in the application layer per-region.
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_fixed_amount_range;
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_variable_percent_range;
