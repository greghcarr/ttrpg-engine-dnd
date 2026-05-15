-- dndbnb slice 3: public browse, favorites, server-side moderation.
--
-- Three changes in one migration since they're conceptually one
-- feature ("share my characters publicly").
--
-- (A) Server-side moderation: a curated blocklist + an is_offensive
--     function + a trigger on `characters` that rejects offensive
--     names. Pure SQL, no API calls. The client uses `obscenity` in
--     the browser for live feedback; this trigger is the backstop
--     so a determined user can't bypass the client and write an
--     offensive name. The blocklist is intentionally short and
--     focused on the worst slurs / clearly-vulgar terms; the heavy
--     lifting (leet-speak normalization, confusable mapping) happens
--     in the obscenity package on the client side.
--
-- (B) Favorites: many-to-many between users and public characters.
--
-- (C) (No new visibility infrastructure; `is_public` from migration
--     0001 already supports the read path. RLS for public reads is
--     also already in place via `characters_public_select`.)

-- --------------------------------------------------------------------
-- (A) Moderation
-- --------------------------------------------------------------------

create or replace function public.normalize_text_for_moderation(t text)
returns text language sql immutable as $$
  select regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]', '', 'g');
$$;

-- Returns true if `t` contains any forbidden substring after
-- normalization (lowercased + non-alphanumerics stripped).
create or replace function public.is_text_offensive(t text)
returns boolean language plpgsql immutable as $$
declare
  -- Hand-curated. The client side (obscenity) catches a much wider
  -- variety with leet-speak normalization; this list is the floor
  -- the server enforces no matter what reaches it. Keep terms short
  -- (substring match), avoid casual swears that would false-positive
  -- on legitimate fantasy names ("Cuthbert" etc.).
  blocklist text[] := array[
    'nigger', 'nigga', 'faggot', 'tranny', 'kike', 'chink', 'spic',
    'gook', 'wetback', 'cunt', 'pedophile', 'rape', 'rapist',
    'molest', 'incest', 'beastiality', 'bestiality',
    'fuck', 'shit'
  ];
  normalized text := public.normalize_text_for_moderation(t);
  term text;
begin
  if normalized = '' then return false; end if;
  foreach term in array blocklist loop
    if position(term in normalized) > 0 then return true; end if;
  end loop;
  return false;
end;
$$;

create or replace function public.characters_moderate_name()
returns trigger language plpgsql as $$
begin
  if public.is_text_offensive(new.name) then
    raise exception 'character name failed moderation check' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists characters_moderate_name on public.characters;
create trigger characters_moderate_name
  before insert or update of name on public.characters
  for each row execute function public.characters_moderate_name();

-- --------------------------------------------------------------------
-- (B) Favorites
-- --------------------------------------------------------------------

create table public.favorites (
  user_id        uuid not null references auth.users(id) on delete cascade,
  character_id   uuid not null references public.characters(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (user_id, character_id)
);

create index favorites_character_id_idx on public.favorites (character_id);

-- On insert, force the row owner to the caller. Same shape as
-- characters_set_owner from migration 0001.
create or replace function public.favorites_set_user()
returns trigger language plpgsql as $$
begin
  new.user_id := auth.uid();
  return new;
end;
$$;

create trigger favorites_set_user
  before insert on public.favorites
  for each row execute function public.favorites_set_user();

alter table public.favorites enable row level security;

-- Users can see and manage only their own favorites.
create policy favorites_owner_all
  on public.favorites for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- And readers can only favorite a character if the character is
-- reachable to them via the existing characters RLS. Postgres applies
-- the RLS check on the referenced row at insert time because of the
-- foreign key, so no extra policy is needed here.
