-- dndbnb slice 1: characters table + row-level security.
--
-- Run this in your Supabase project's SQL editor (or via the Supabase
-- CLI: `supabase db push`). See dndbnb/README.md for project setup.
--
-- Schema goals:
--   * One row per character, owned by exactly one auth.users row.
--   * Engine character document stored as `payload jsonb` so the
--     schema-versioned Character shape is the source of truth; this
--     table is just a thin index over it.
--   * `is_public` flag is opt-in for the future public browse list
--     (phase 3 of the roadmap); defaulted to false today so no one
--     accidentally ships a private character to the world.
--   * `schema_version` mirrored from src/version.ts so a future
--     migration knows which payloads need rewriting.

create extension if not exists "pgcrypto";

create table public.characters (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  name            text not null check (length(name) between 1 and 80),
  is_public       boolean not null default false,
  payload         jsonb not null,
  schema_version  integer not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index characters_owner_id_idx on public.characters (owner_id);
create index characters_is_public_idx on public.characters (is_public) where is_public;

-- Keep updated_at fresh on every row update.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger characters_set_updated_at
  before update on public.characters
  for each row execute function public.set_updated_at();

-- Force the owner_id to the caller's auth.uid() on insert. Prevents
-- a client from forging ownership even if RLS lets the row through.
create or replace function public.characters_set_owner()
returns trigger language plpgsql as $$
begin
  new.owner_id := auth.uid();
  return new;
end;
$$;

create trigger characters_set_owner
  before insert on public.characters
  for each row execute function public.characters_set_owner();

-- Row-level security: owners have full access; everyone else can
-- read rows flagged `is_public`. The campaign-scope read path joins
-- through a memberships table that lands in a later slice.
alter table public.characters enable row level security;

create policy characters_owner_select
  on public.characters for select
  using (owner_id = auth.uid());

create policy characters_public_select
  on public.characters for select
  using (is_public);

create policy characters_owner_insert
  on public.characters for insert
  with check (auth.uid() is not null);

create policy characters_owner_update
  on public.characters for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy characters_owner_delete
  on public.characters for delete
  using (owner_id = auth.uid());
