-- dndbnb fix: campaign creation was 403'ing.
--
-- Root cause: 0003's `campaigns_seed_owner_membership` AFTER INSERT
-- trigger inserts a row into `campaign_members` with no INSERT
-- policy. Trigger functions run as the invoking user unless marked
-- SECURITY DEFINER, so the trigger's insert hit RLS and the entire
-- transaction rolled back; PostgREST surfaced that as a 403 to the
-- caller. The same shape applied silently to anyone trying to create
-- a campaign.
--
-- Two fixes are possible:
--   A. SECURITY DEFINER on the trigger function so it bypasses RLS.
--   B. An INSERT policy on campaign_members that lets a user insert
--      themselves as 'owner' when they own the referenced campaign.
-- Option A is tighter (no client-callable insert path on
-- campaign_members; the trigger is the only entry point) and matches
-- the existing pattern for `handle_new_auth_user` and `join_campaign`,
-- both of which are SECURITY DEFINER for similar reasons.

create or replace function public.campaigns_seed_owner_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.campaign_members (campaign_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;
