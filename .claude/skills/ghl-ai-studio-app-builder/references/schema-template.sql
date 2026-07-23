-- {{App Name}} — Supabase schema
-- Multi-tenant from day one: every app-owned table carries org_id so other
-- orgs can reuse this app without a migration.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tenants (shared scaffold — reuse the existing organizations table/rows if
-- another app in this repo has already created it; don't create a second
-- tenants table per app).
-- ---------------------------------------------------------------------------
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,        -- e.g. 'gm_baptist_outreach', 'automate_south'
  name text not null,
  created_at timestamptz not null default now()
);

insert into organizations (slug, name)
values ('{{org_slug}}', '{{Org Name}}')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- {{Primary entity table, e.g. "Videos", "Contacts", "Events"}}
-- ---------------------------------------------------------------------------
create table if not exists {{entity_table}} (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  -- app-specific columns here
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists {{entity_table}}_org_status_idx on {{entity_table}} (org_id, status);

-- Only add this if the app has a search screen:
-- create index if not exists {{entity_table}}_search_idx on {{entity_table}}
--   using gin (to_tsvector('english', title || ' ' || coalesce(description, '')));

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists {{entity_table}}_set_updated_at on {{entity_table}};
create trigger {{entity_table}}_set_updated_at
  before update on {{entity_table}}
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Event log — only add this if the app tracks a repeated user action
-- (clicks, copies, views) that needs deduping per user per minute.
-- ---------------------------------------------------------------------------
create table if not exists {{entity_table}}_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  {{entity_table_singular}}_id uuid not null references {{entity_table}}(id) on delete cascade,
  user_identifier text not null,   -- auth.uid()::text, or a persisted anonymous device uuid
  event_type text not null,        -- e.g. 'copy_button', 'view'
  minute_bucket timestamptz not null,
  created_at timestamptz not null default now(),
  unique ({{entity_table_singular}}_id, user_identifier, event_type, minute_bucket)
);

create index if not exists {{entity_table}}_events_entity_idx
  on {{entity_table}}_events ({{entity_table_singular}}_id, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table {{entity_table}} enable row level security;
alter table {{entity_table}}_events enable row level security;

-- Public (anon) read access to published rows only.
create policy "public read published {{entity_table}}"
  on {{entity_table}} for select
  using (status = 'published');

-- Public (anon) can log events, but never read/update/delete them.
create policy "public insert {{entity_table}} events"
  on {{entity_table}}_events for insert
  with check (true);

-- Staff (authenticated) manage content. Restrict further with a role/claim
-- check once a staff table or JWT claim exists; service-role (Edge
-- Functions, this repo's server) bypasses RLS entirely.
create policy "authenticated manage {{entity_table}}"
  on {{entity_table}} for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated read {{entity_table}} events"
  on {{entity_table}}_events for select
  using (auth.role() = 'authenticated');
