-- dndbnb: surface the character's species id as a queryable column,
-- matching the pattern of primary_class_id in migration 0010. Lets
-- list views show "Tiefling Hunter"-style summaries without pulling
-- the whole payload.

alter table public.characters
  add column if not exists species_id text generated always as (
    payload->>'speciesId'
  ) stored;

notify pgrst, 'reload schema';
