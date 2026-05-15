-- dndbnb slice 4: campaigns + member rosters + character attach.
--
-- Also introduces `profiles` so usernames are visible to other users
-- (auth.users isn't directly queryable, and we don't want to expose
-- the synthetic <username>@dndbnb.invalid emails). Profiles are
-- auto-populated from the synthetic email on every new auth.users
-- insert via a trigger; existing users are backfilled inline.

-- --------------------------------------------------------------------
-- (A) Profiles
-- --------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique,
  created_at  timestamptz not null default now()
);

-- Backfill any users created before this migration (synthetic-email
-- accounts from earlier slices). Strips `@dndbnb.invalid` to recover
-- the username the user actually picked.
insert into public.profiles (id, username)
select id, split_part(email, '@', 1)
from auth.users
where email is not null
on conflict (id) do nothing;

-- Mirror the username out of the synthetic email on every new signup.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;

-- Profiles are world-readable for any authenticated session. Usernames
-- are how players identify each other in browse / member rosters.
create policy profiles_authenticated_select
  on public.profiles for select
  to authenticated
  using (true);

-- --------------------------------------------------------------------
-- (B) Campaigns + members
-- --------------------------------------------------------------------

-- Short, easy-to-share invite code. 31^8 = ~852bn possibilities;
-- collision risk is negligible for a hobby project. Alphabet skips
-- confusable characters (0/O, 1/I/l).
create or replace function public.generate_join_code()
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

create table public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  name         text not null check (length(name) between 1 and 80),
  description  text not null default '' check (length(description) <= 500),
  join_code    text not null unique default public.generate_join_code(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index campaigns_owner_id_idx on public.campaigns (owner_id);

create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

-- Force owner_id on insert to the caller (same pattern as characters).
create or replace function public.campaigns_set_owner()
returns trigger language plpgsql as $$
begin
  new.owner_id := auth.uid();
  return new;
end;
$$;

create trigger campaigns_set_owner
  before insert on public.campaigns
  for each row execute function public.campaigns_set_owner();

-- Moderation on campaign name + description, same as characters.
create or replace function public.campaigns_moderate_text()
returns trigger language plpgsql as $$
begin
  if public.is_text_offensive(new.name)
     or public.is_text_offensive(new.description) then
    raise exception 'campaign text failed moderation check' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger campaigns_moderate_text
  before insert or update of name, description on public.campaigns
  for each row execute function public.campaigns_moderate_text();

create table public.campaign_members (
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'player' check (role in ('owner', 'player')),
  joined_at    timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create index campaign_members_user_id_idx on public.campaign_members (user_id);

-- When a campaign is created, the creator is auto-added as the owner.
create or replace function public.campaigns_seed_owner_membership()
returns trigger language plpgsql as $$
begin
  insert into public.campaign_members (campaign_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger campaigns_seed_owner_membership
  after insert on public.campaigns
  for each row execute function public.campaigns_seed_owner_membership();

-- --------------------------------------------------------------------
-- (C) Membership helpers (SECURITY DEFINER so they bypass RLS, which
--     would otherwise recurse when used inside campaign_members /
--     campaigns policies).
-- --------------------------------------------------------------------

create or replace function public.is_campaign_member(cid uuid, uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.campaign_members
    where campaign_id = cid and user_id = uid
  );
$$;

create or replace function public.is_campaign_owner(cid uuid, uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.campaigns
    where id = cid and owner_id = uid
  );
$$;

-- --------------------------------------------------------------------
-- (D) RLS for campaigns + members
-- --------------------------------------------------------------------

alter table public.campaigns enable row level security;

create policy campaigns_member_select
  on public.campaigns for select
  using (public.is_campaign_member(id, auth.uid()));

-- A signed-in user can also read a campaign by join code (the join
-- flow needs to look up the campaign before they become a member).
-- That happens via a SECURITY DEFINER RPC defined below, so no extra
-- SELECT policy is needed here.

create policy campaigns_owner_insert
  on public.campaigns for insert
  with check (auth.uid() is not null);

create policy campaigns_owner_update
  on public.campaigns for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy campaigns_owner_delete
  on public.campaigns for delete
  using (owner_id = auth.uid());

alter table public.campaign_members enable row level security;

create policy campaign_members_visible_to_members
  on public.campaign_members for select
  using (public.is_campaign_member(campaign_id, auth.uid()));

-- A member can leave (delete their own row); the campaign owner can
-- remove anyone (but typically the join flow inserts; kick is future
-- work). Owner can't be removed via this policy; we'll add a guard
-- once the kick flow lands.
create policy campaign_members_self_delete
  on public.campaign_members for delete
  using (user_id = auth.uid());

create policy campaign_members_owner_delete
  on public.campaign_members for delete
  using (public.is_campaign_owner(campaign_id, auth.uid()));

-- The join RPC inserts membership rows on behalf of users; we don't
-- expose a general insert policy because join codes are the gating
-- mechanism. The owner's own membership row gets seeded by the
-- after-insert trigger on campaigns (bypasses RLS).

-- --------------------------------------------------------------------
-- (E) Join RPC: callable from authenticated clients with just a code.
-- --------------------------------------------------------------------

create or replace function public.join_campaign(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  target uuid;
begin
  if uid is null then
    raise exception 'must be signed in';
  end if;
  select id into target from public.campaigns where join_code = code;
  if target is null then
    raise exception 'no campaign with that join code' using errcode = 'no_data_found';
  end if;
  insert into public.campaign_members (campaign_id, user_id, role)
  values (target, uid, 'player')
  on conflict (campaign_id, user_id) do nothing;
  return target;
end;
$$;

grant execute on function public.join_campaign(text) to authenticated;

-- --------------------------------------------------------------------
-- (F) Characters: campaign_id column + campaign-visibility policy.
-- --------------------------------------------------------------------

alter table public.characters
  add column campaign_id uuid references public.campaigns(id) on delete set null;

create index characters_campaign_id_idx on public.characters (campaign_id);

-- Visibility extension: members of the same campaign see each other's
-- attached characters even when those characters aren't public.
create policy characters_campaign_member_select
  on public.characters for select
  using (
    campaign_id is not null
    and public.is_campaign_member(campaign_id, auth.uid())
  );

-- Update policy needs a new check: when a user sets campaign_id on
-- their character, they must be a member of that campaign. Drop and
-- recreate so the policy reflects the new column.
drop policy if exists characters_owner_update on public.characters;
create policy characters_owner_update
  on public.characters for update
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (campaign_id is null or public.is_campaign_member(campaign_id, auth.uid()))
  );
