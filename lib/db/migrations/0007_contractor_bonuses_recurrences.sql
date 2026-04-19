-- Phase: contractor bonuses + recurring deliverables
-- Part of the admin contractor management project. Applied via `pnpm db:push`;
-- this file is informational but reflects the resulting schema.

DO $$ BEGIN
  CREATE TYPE "contractor_bonus_condition" AS ENUM (
    'all_deliverables_done',
    'min_deliverables_done',
    'manual'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "contractor_bonus_status" AS ENUM (
    'pending',
    'earned',
    'forfeited',
    'paid'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "deliverable_recurrence_frequency" AS ENUM (
    'daily',
    'weekly',
    'monthly'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "contractor_bonuses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "contractor_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "brand_id" uuid REFERENCES "brands"("id") ON DELETE SET NULL,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" char(3) NOT NULL DEFAULT 'USD',
  "condition_type" contractor_bonus_condition NOT NULL DEFAULT 'manual',
  "condition_min_count" integer,
  "status" contractor_bonus_status NOT NULL DEFAULT 'pending',
  "note" text,
  "resolved_at" timestamptz,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "contractor_bonuses_contractor_period_idx"
  ON "contractor_bonuses" ("contractor_user_id", "period_start");
CREATE INDEX IF NOT EXISTS "contractor_bonuses_status_idx"
  ON "contractor_bonuses" ("status");

CREATE TABLE IF NOT EXISTS "deliverable_recurrences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "brand_id" uuid NOT NULL REFERENCES "brands"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "type" deliverable_type NOT NULL DEFAULT 'custom',
  "assignee_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "fixed_share_bps" integer NOT NULL DEFAULT 0,
  "frequency" deliverable_recurrence_frequency NOT NULL,
  "interval_count" integer NOT NULL DEFAULT 1,
  "next_run_on" date NOT NULL,
  "last_run_on" date,
  "active" boolean NOT NULL DEFAULT true,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "deliverable_recurrences_brand_active_next_run_idx"
  ON "deliverable_recurrences" ("brand_id", "active", "next_run_on");
