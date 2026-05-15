-- dndbnb: per-owner manual sort order for the My Characters list.
--
-- The column is a plain integer (no constraint other than NOT NULL +
-- default 0). The client renumbers contiguously on each reorder and
-- the list query sorts ASC; older rows that haven't been reordered
-- fall back to updated_at DESC via the secondary order in the client.

alter table public.characters
  add column if not exists sort_order integer not null default 0;

create index if not exists characters_owner_sort_order_idx
  on public.characters (owner_id, sort_order);

notify pgrst, 'reload schema';
