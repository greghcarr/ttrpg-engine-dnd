-- dndbnb fix: the REAL cause of the persistent campaign-create
-- "violates RLS" error.
--
-- Root cause analysis:
--   * supabase-js `.from('campaigns').insert(...).select('*').single()`
--     sends `Prefer: return=representation`, which translates to
--     `INSERT ... RETURNING *` in Postgres.
--   * RETURNING applies the table's SELECT policies (USING) to filter
--     which rows the caller can see back.
--   * Our only SELECT policy on campaigns is `campaigns_member_select`
--     using `is_campaign_member(id, auth.uid())`, which checks for a
--     row in `campaign_members`.
--   * But the membership row for the owner is seeded by an AFTER
--     INSERT trigger (`campaigns_seed_owner_membership`), and AFTER
--     triggers fire *after* RETURNING is built. So at RETURNING time
--     no membership row exists yet -- USING returns false -- the row
--     is filtered to zero -- PostgREST reports the write as an RLS
--     violation.
--
-- This explains the mystery: pg_policies looked correct, auth.uid()
-- looked correct, but the response still 403'd because PostgREST got
-- back zero rows from what should have been a one-row RETURNING.
--
-- Characters didn't have this problem because 0001 also gave them
-- `characters_owner_select using (owner_id = auth.uid())`, which is
-- satisfied at INSERT time without any trigger dependency.
--
-- Fix: add the analogous owner-select policy for campaigns. Owners
-- should be able to read their own campaign regardless of membership
-- state; that's the right shape independently.

create policy campaigns_owner_select
  on public.campaigns for select
  using (owner_id = auth.uid());

notify pgrst, 'reload schema';
