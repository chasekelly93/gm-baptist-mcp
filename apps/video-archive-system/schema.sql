-- Video Archive & Analytics System — Supabase schema
-- Multi-tenant from day one: every catalog/event table carries org_id so
-- Automate South (or any future org) can reuse this without a migration.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------------
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,        -- e.g. 'gm_baptist_outreach', 'automate_south'
  name text not null,
  created_at timestamptz not null default now()
);

insert into organizations (slug, name)
values ('gm_baptist_outreach', 'GM Baptist Outreach')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Categories (org-scoped taxonomy)
-- ---------------------------------------------------------------------------
create table if not exists video_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (org_id, slug)
);

-- ---------------------------------------------------------------------------
-- Videos
-- ---------------------------------------------------------------------------
create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  category_id uuid references video_categories(id) on delete set null,
  title text not null,
  description text,
  loom_url text not null,
  loom_video_id text,
  thumbnail_url text,
  ai_generated boolean not null default false,
  ai_raw_summary text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists videos_org_status_idx on videos (org_id, status);
create index if not exists videos_search_idx on videos
  using gin (to_tsvector('english', title || ' ' || coalesce(description, '')));

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists videos_set_updated_at on videos;
create trigger videos_set_updated_at
  before update on videos
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Click / copy events — deduped per user per video per minute
-- ---------------------------------------------------------------------------
create table if not exists video_click_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  video_id uuid not null references videos(id) on delete cascade,
  user_identifier text not null,   -- auth.uid()::text, or a persisted anonymous device uuid
  source text not null default 'copy_button' check (source in ('copy_button', 'view')),
  minute_bucket timestamptz not null,
  created_at timestamptz not null default now(),
  unique (video_id, user_identifier, source, minute_bucket)
);

create index if not exists video_click_events_video_idx on video_click_events (video_id, created_at);

-- ---------------------------------------------------------------------------
-- Search events — powers "content gap" reporting
-- ---------------------------------------------------------------------------
create table if not exists video_search_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  query text not null,
  result_count int not null default 0,
  clicked_video_id uuid references videos(id) on delete set null,
  searched_by text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table video_categories enable row level security;
alter table videos enable row level security;
alter table video_click_events enable row level security;
alter table video_search_events enable row level security;

-- Public (anon) read access to published videos and their categories only.
create policy "public read published videos"
  on videos for select
  using (status = 'published');

create policy "public read categories"
  on video_categories for select
  using (true);

-- Public (anon) can log click and search events, but never read/update/delete them.
create policy "public insert click events"
  on video_click_events for insert
  with check (true);

create policy "public insert search events"
  on video_search_events for insert
  with check (true);

-- Staff (authenticated) manage catalog content. Restrict further with a
-- role/claim check once a staff table or JWT claim exists; service-role
-- (Edge Functions, this repo's server) bypasses RLS entirely.
create policy "authenticated manage videos"
  on videos for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated manage categories"
  on video_categories for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated read click events"
  on video_click_events for select
  using (auth.role() = 'authenticated');

create policy "authenticated read search events"
  on video_search_events for select
  using (auth.role() = 'authenticated');
