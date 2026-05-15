-- dndbnb: per-campaign icon id.
--
-- Free-form text rather than an enum so the icon registry can grow on
-- the client without a SQL change. Default 'shield' so existing rows
-- (and any insert that doesn't specify an icon) get a sensible
-- starting glyph.

alter table public.campaigns
  add column if not exists icon text not null default 'shield';

notify pgrst, 'reload schema';
