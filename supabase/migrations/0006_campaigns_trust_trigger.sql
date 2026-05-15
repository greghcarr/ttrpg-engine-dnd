-- dndbnb fix: campaigns RLS still rejecting Create after 0005.
--
-- Hypothesis: `to authenticated with check (true)` is failing because
-- the role on the connection isn't `authenticated` (PostgREST schema
-- cache hadn't picked up the new policy, or the JWT isn't being seen
-- the way we expect). Rather than keep guessing, hand the gate to the
-- BEFORE INSERT trigger -- it can read auth.uid() and raise a
-- specific error -- and make the policy itself the most permissive
-- thing that still hits Postgres RLS (any role, `with check (true)`).
--
-- Net effect:
--   * If auth.uid() is null in the trigger -> readable
--     "must be signed in" error.
--   * If auth.uid() is non-null -> trigger fills owner_id, policy
--     passes, AFTER INSERT seeds the membership row.
--
-- Also adds a tiny debug RPC the client can call to see what the
-- server thinks about the current request's auth state, plus a
-- schema-cache reload so PostgREST picks the new policy up
-- immediately instead of waiting for its next refresh.

drop policy if exists campaigns_owner_insert on public.campaigns;
drop policy if exists campaigns_anyone_insert on public.campaigns;

create policy campaigns_anyone_insert
  on public.campaigns for insert
  with check (true);

-- Trigger does the real gate. Same shape as 0005, kept here so this
-- migration is self-contained.
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

-- Diagnostic RPC: callable by anyone, returns what the server sees
-- about the current request's auth state. Useful when an RLS-style
-- error shows up and we need to know whether the client is actually
-- sending the JWT.
create or replace function public.debug_auth_state()
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'uid', auth.uid(),
    'role', auth.role(),
    'has_jwt_claims', current_setting('request.jwt.claims', true) is not null
  );
$$;
grant execute on function public.debug_auth_state() to anon, authenticated;

-- Force PostgREST to refresh its policy / function cache so the
-- change is picked up immediately rather than on the next polling
-- interval.
notify pgrst, 'reload schema';
