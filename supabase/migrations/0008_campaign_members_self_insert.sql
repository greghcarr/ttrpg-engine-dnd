-- dndbnb fix: belt-and-suspenders RLS for campaign_members INSERT.
--
-- The campaigns INSERT policy is `with check (true)` and auth shows
-- role=authenticated with a non-null auth.uid(). Under standard
-- Postgres semantics, the campaigns INSERT cannot fail RLS. The
-- remaining suspect is the AFTER INSERT trigger
-- `campaigns_seed_owner_membership`, which inserts into
-- campaign_members. Migration 0004 set that trigger SECURITY DEFINER
-- so it should bypass RLS, but if for any reason that hasn't taken
-- (or PostgREST is bubbling the inner failure up labeled with the
-- outer table), the symptom matches.
--
-- Fix: an explicit INSERT policy on campaign_members that allows a
-- user to insert their own membership row. The seed-owner trigger
-- sets user_id := new.owner_id which is the campaign creator's
-- auth.uid(), so this policy lets the trigger's insert succeed even
-- with SECURITY INVOKER semantics.
--
-- This is additive; it doesn't open campaign_members to arbitrary
-- inserts because the check pins user_id to the caller. join_campaign
-- (which inserts membership for someone other than the owner) is
-- still SECURITY DEFINER and bypasses RLS anyway.

drop policy if exists campaign_members_self_insert on public.campaign_members;

create policy campaign_members_self_insert
  on public.campaign_members for insert
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
