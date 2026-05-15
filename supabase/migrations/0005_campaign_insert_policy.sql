-- dndbnb fix: "new row violates row-level security policy for
-- table 'campaigns'" on Create.
--
-- 0003's policy was:
--   create policy campaigns_owner_insert on public.campaigns
--     for insert with check (auth.uid() is not null);
-- Without an explicit `to` clause, the policy applies to all roles
-- (including `anon`). For a signed-in user, `auth.uid()` should be
-- their UUID, but in practice this check can come back null (e.g.,
-- when the role is bound but the JWT claim path isn't what
-- `auth.uid()` reads from). The result: a confusing 42501 / "row
-- violates RLS" instead of a useful "not signed in".
--
-- Fix:
--   1. Rebind the policy to `to authenticated` so anon never reaches
--      the check.
--   2. Drop the `auth.uid()` predicate from the policy (the
--      `authenticated` role binding already gates anon).
--   3. Harden `campaigns_set_owner` so it raises a clear error if
--      `auth.uid()` is somehow null — that way any future weirdness
--      surfaces as "must be signed in" rather than a generic RLS
--      violation.

drop policy if exists campaigns_owner_insert on public.campaigns;

create policy campaigns_owner_insert
  on public.campaigns for insert
  to authenticated
  with check (true);

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
