-- dndbnb fix: aggressive reset of campaigns RLS, with before/after
-- diagnostic logging.
--
-- The "violates RLS for table campaigns" error keeps showing up even
-- though the auth context is clean (role=authenticated, uid non-null,
-- JWT present). That means *something* policy-shaped is rejecting
-- the INSERT, but the policy we *think* exists is `with check (true)`
-- which can't fail. Most likely cause: an earlier migration didn't
-- fully apply, so the live policy list isn't what we expect.
--
-- This migration:
--   1. Prints the current RLS state + policies via RAISE NOTICE.
--   2. Drops every policy we know about on `public.campaigns`.
--   3. Recreates them cleanly (with the trust-the-trigger INSERT
--      policy from 0006).
--   4. Re-applies the SECURITY DEFINER + null-guard work on the two
--      campaigns triggers in case 0004/0005/0006 didn't apply.
--   5. Prints the resulting state.
--   6. Notifies PostgREST to reload its schema cache.
--
-- The RAISE NOTICE output shows up in the Supabase SQL editor; if
-- this still fails, paste that output and we'll have actionable info.

do $$
declare
  pol record;
  rls_on boolean;
begin
  select relrowsecurity into rls_on
    from pg_class
    where relnamespace = 'public'::regnamespace and relname = 'campaigns';
  raise notice 'BEFORE: campaigns RLS enabled = %', rls_on;
  for pol in
    select policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public' and tablename = 'campaigns'
    order by policyname
  loop
    raise notice 'BEFORE: % | permissive=% | roles=% | cmd=% | qual=% | with_check=%',
      pol.policyname, pol.permissive, pol.roles, pol.cmd, pol.qual, pol.with_check;
  end loop;
end$$;

drop policy if exists campaigns_owner_insert on public.campaigns;
drop policy if exists campaigns_anyone_insert on public.campaigns;
drop policy if exists campaigns_member_select on public.campaigns;
drop policy if exists campaigns_owner_update on public.campaigns;
drop policy if exists campaigns_owner_delete on public.campaigns;

create policy campaigns_anyone_insert
  on public.campaigns for insert
  with check (true);

create policy campaigns_member_select
  on public.campaigns for select
  using (public.is_campaign_member(id, auth.uid()));

create policy campaigns_owner_update
  on public.campaigns for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy campaigns_owner_delete
  on public.campaigns for delete
  using (owner_id = auth.uid());

-- Re-apply the trigger functions defensively in case prior fix-up
-- migrations didn't fully apply on this project.

create or replace function public.campaigns_set_owner()
returns trigger language plpgsql as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'must be signed in to create a campaign'
      using errcode = 'insufficient_privilege';
  end if;
  new.owner_id := caller;
  return new;
end;
$$;

create or replace function public.campaigns_seed_owner_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.campaign_members (campaign_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

do $$
declare
  pol record;
  rls_on boolean;
begin
  select relrowsecurity into rls_on
    from pg_class
    where relnamespace = 'public'::regnamespace and relname = 'campaigns';
  raise notice 'AFTER: campaigns RLS enabled = %', rls_on;
  for pol in
    select policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public' and tablename = 'campaigns'
    order by policyname
  loop
    raise notice 'AFTER: % | permissive=% | roles=% | cmd=% | qual=% | with_check=%',
      pol.policyname, pol.permissive, pol.roles, pol.cmd, pol.qual, pol.with_check;
  end loop;
end$$;

notify pgrst, 'reload schema';
