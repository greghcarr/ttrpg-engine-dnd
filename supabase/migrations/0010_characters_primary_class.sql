-- dndbnb: surface the primary class as a queryable column so list
-- views can tint each card by class without loading the whole
-- payload.
--
-- The class id lives at `payload.classes[0].classId`. A stored
-- generated column lets us index/filter on it later if we want
-- (e.g. "browse only wizards"), at the cost of a few bytes per row.

alter table public.characters
  add column if not exists primary_class_id text generated always as (
    payload->'classes'->0->>'classId'
  ) stored;

create index if not exists characters_primary_class_id_idx
  on public.characters (primary_class_id);

notify pgrst, 'reload schema';
