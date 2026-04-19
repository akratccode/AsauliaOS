-- Row Level Security policies for the Asaulia tenant model.
-- Applied via Supabase SQL editor or a manual migration. Policies assume the
-- Supabase-managed auth.uid() function returns the current authenticated user
-- as a UUID. Every tenant table has RLS enabled; writes are additionally
-- gated by authorize() in the app layer (see lib/auth/rbac.ts, Phase 03).

-- Helper: is the current user a member of this brand?
create or replace function public.is_brand_member(_brand_id uuid)
returns boolean language sql security definer stable as $$
  select exists(
    select 1 from public.brand_members
    where brand_id = _brand_id
      and user_id = auth.uid()
  );
$$;

-- Helper: is the current user an admin or operator?
create or replace function public.is_staff()
returns boolean language sql security definer stable as $$
  select exists(
    select 1 from public.users
    where id = auth.uid()
      and global_role in ('admin', 'operator')
  );
$$;

-- Enable RLS
alter table public.users enable row level security;
alter table public.brands enable row level security;
alter table public.brand_members enable row level security;
alter table public.plans enable row level security;
alter table public.contractor_profiles enable row level security;
alter table public.brand_contractors enable row level security;
alter table public.deliverables enable row level security;
alter table public.deliverable_attachments enable row level security;
alter table public.deliverable_comments enable row level security;
alter table public.deliverable_activity enable row level security;
alter table public.deliverable_comment_mentions enable row level security;
alter table public.sales_integrations enable row level security;
alter table public.sales_records enable row level security;
alter table public.invoices enable row level security;
alter table public.payouts enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- Users: self or staff.
create policy users_self_select on public.users
  for select using (id = auth.uid() or public.is_staff());

-- Brands.
create policy brands_member_select on public.brands
  for select using (public.is_brand_member(id) or public.is_staff());

-- Brand members.
create policy brand_members_select on public.brand_members
  for select using (user_id = auth.uid() or public.is_brand_member(brand_id) or public.is_staff());

-- Plans.
create policy plans_select on public.plans
  for select using (public.is_brand_member(brand_id) or public.is_staff());

-- Contractor profiles: self or staff.
create policy contractor_profiles_select on public.contractor_profiles
  for select using (user_id = auth.uid() or public.is_staff());

-- Brand contractors: brand members see their brand's rows, contractor sees their own rows, staff sees all.
create policy brand_contractors_select on public.brand_contractors
  for select using (
    public.is_brand_member(brand_id) or contractor_user_id = auth.uid() or public.is_staff()
  );

-- Deliverables.
create policy deliverables_select on public.deliverables
  for select using (
    public.is_brand_member(brand_id) or assignee_user_id = auth.uid() or public.is_staff()
  );

create policy deliverable_attachments_select on public.deliverable_attachments
  for select using (
    exists (
      select 1 from public.deliverables d
      where d.id = deliverable_id
        and (public.is_brand_member(d.brand_id) or d.assignee_user_id = auth.uid() or public.is_staff())
    )
  );

create policy deliverable_comments_select on public.deliverable_comments
  for select using (
    exists (
      select 1 from public.deliverables d
      where d.id = deliverable_id
        and (public.is_brand_member(d.brand_id) or d.assignee_user_id = auth.uid() or public.is_staff())
    )
  );

create policy deliverable_activity_select on public.deliverable_activity
  for select using (
    exists (
      select 1 from public.deliverables d
      where d.id = deliverable_id
        and (public.is_brand_member(d.brand_id) or d.assignee_user_id = auth.uid() or public.is_staff())
    )
  );

create policy deliverable_comment_mentions_select on public.deliverable_comment_mentions
  for select using (
    exists (
      select 1 from public.deliverable_comments c
      join public.deliverables d on d.id = c.deliverable_id
      where c.id = comment_id
        and (public.is_brand_member(d.brand_id) or d.assignee_user_id = auth.uid() or public.is_staff())
    )
  );

-- Sales.
create policy sales_integrations_select on public.sales_integrations
  for select using (public.is_brand_member(brand_id) or public.is_staff());

create policy sales_records_select on public.sales_records
  for select using (public.is_brand_member(brand_id) or public.is_staff());

-- Billing.
create policy invoices_select on public.invoices
  for select using (public.is_brand_member(brand_id) or public.is_staff());

create policy payouts_select on public.payouts
  for select using (contractor_user_id = auth.uid() or public.is_staff());

-- Notifications: self only.
create policy notifications_select on public.notifications
  for select using (user_id = auth.uid());

-- Audit log: staff only.
create policy audit_log_select on public.audit_log
  for select using (public.is_staff());

-- Writes: denied at the policy layer. All writes flow through server actions
-- that use the service role; the service role bypasses RLS by design.
