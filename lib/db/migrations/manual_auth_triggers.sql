-- Phase 03: keep public.users in sync with Supabase's auth.users.
-- Runs as a manual migration in Supabase (auth schema isn't available to
-- drizzle-kit generate). Apply via `supabase db push` or the SQL editor.

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, global_role)
  values (new.id, new.email, 'client')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.handle_auth_user_email_update()
returns trigger language plpgsql security definer as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email, updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_auth_user_email_update();
