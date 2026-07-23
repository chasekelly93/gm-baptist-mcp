---
name: ghl-ai-studio-app-builder
description: >
  Scaffolds a new custom app for GHL AI Studio in this repo: a React Native
  (Expo) frontend backed by Supabase, multi-tenant from day one via an
  organizations/org_id pattern so GM Baptist Outreach, Automate South, and
  any future org can share the same app and schema without a migration.
  Produces a SPEC.md (product/technical spec) and schema.sql (runnable
  Supabase Postgres DDL with RLS) under apps/<app-slug>/, following the
  precedent already in apps/video-archive-system/. Use this skill whenever
  the user describes a new app idea meant for GHL AI Studio, says things
  like "build an app," "scaffold a React Native + Supabase app," "create a
  new app idea," "I want an app that tracks/catalogs/manages X," or
  describes a tool for GM Baptist Outreach or Automate South that clearly
  needs its own screens and its own data — even if they never say "React
  Native," "Supabase," or "GHL AI Studio" explicitly. Reach for this skill
  before free-styling a one-off spec document for a new app idea in this
  repo; it keeps every app's data model consistent and reusable across orgs.
---

# GHL AI Studio App Builder

This repo (`gm-baptist-mcp`) is the GHL/Supabase integration layer for GM
Baptist Outreach, and it doubles as the home for spec-and-schema-first app
ideas meant to be built out in GHL AI Studio as React Native (Expo) apps
with Supabase as the backend. `apps/video-archive-system/` is the reference
implementation of this pattern — when in doubt about a judgment call below,
open that folder and match what it did.

## Why this pattern, not a one-off

Every app built this way ends up needing the same three things: a place to
find the video/contact/whatever a person needs, a metric on how it's
actually used, and room for a second org (Automate South today, maybe others
later) to run the same app without anyone re-modeling the database. Baking
`organizations` / `org_id` into the schema on day one costs almost nothing
and avoids a real migration later — that's the main thing this skill exists
to enforce, along with keeping specs consistent enough that GHL AI Studio
(or a future engineer) can pick any `apps/<slug>/SPEC.md` and know exactly
what to build.

## Workflow

### 1. Nail down the idea before writing anything

Don't scaffold files from a vague one-liner. From the conversation, extract
(and ask the user for anything missing):

- **The problem** — what's broken or missing today, in one or two sentences.
- **Core goals** — the 3-6 things the app must actually do. Push for
  concrete verbs: "track," "search," "catalog," "generate," "flag" — not
  "manage stuff."
- **Non-goals for v1** — what's explicitly out of scope so the spec doesn't
  quietly balloon. If the user describes a stretch idea ("eventually it
  could also..."), that's a Phase 2 item, not a v1 goal.
- **Key entities and actions** — the nouns that become tables (a video, a
  contact, an order) and the verbs that become events worth tracking (a
  copy, a click, a submission).
- **Which org this is for** — almost always `gm_baptist_outreach` unless the
  user says otherwise, but always confirm rather than assume, since the
  whole point of the schema pattern is that this choice shouldn't matter
  structurally.

If the user has already described all of this in the conversation (as
happened for video-archive-system), don't re-ask — just confirm your
understanding in a sentence before you start writing files.

### 2. Create the app folder

`apps/<app-slug>/` at the repo root, where `<app-slug>` is a short kebab-case
name for the app (e.g. `video-archive-system`, `event-rsvp-tracker`). Two
files go in it: `SPEC.md` and `schema.sql`.

### 3. Write SPEC.md

Use `references/spec-template.md` as the structural skeleton — it's the
video-archive-system spec with the app-specific parts replaced by
placeholders. Fill in every section; don't leave placeholder text in the
final file. In particular, make sure the spec covers:

- Problem, goals, non-goals (from step 1).
- A **data model summary table** — one row per table, one sentence per row
  on what it's for. This is the fast-reference a reader hits before diving
  into `schema.sql`.
- Any AI-assist or automation flow the app needs (not every app needs one —
  video-archive-system's Loom-link-to-metadata flow is an example of the
  shape this takes when it applies: fetch what's publicly available, hand it
  to Claude with relevant context, return a draft for human review, never
  auto-publish).
- The **React Native screen list** — one bullet per screen, noting which
  ones require auth (staff-only) vs. which are public/self-service.
- **Multi-tenancy / RLS notes** — how `org_id` scopes the data, and in plain
  terms what's publicly readable vs. staff-only vs. service-role-only.
- **GHL AI Studio / infra notes** — confirm the app reuses the Supabase
  project already wired into this repo (same `SUPABASE_URL` /
  `SUPABASE_SERVICE_KEY` used by `seed-supabase.js` / `sync.js`) rather than
  provisioning a new project, list the env vars the new app itself needs,
  and note if Expo web export is needed for embedding inside a GHL location.

### 4. Write schema.sql

Use `references/schema-template.sql` as the starting point — it has the
`organizations` scaffold and the standard RLS shape already worked out, with
placeholders for the app's own tables. A few rules that apply to every app
built with this skill, not just the reference example:

- **Every table the app owns carries `org_id references organizations(id)`.**
  No exceptions, even if only one org uses the app today — this is the
  entire point of the pattern.
- **Seed the `organizations` row** for whichever org this app is for (reuse
  the existing row via `on conflict (slug) do nothing` — don't create a
  second `organizations` table per app; every app in this repo shares the
  same tenant scaffold, just different app-specific tables scoped by the
  same `org_id`).
- **Dedup noisy event tables at the database level, not just in the client.**
  Any time the app logs a repeated user action (clicks, views, opens) that
  needs to be counted without noise from rapid repeats, use:
  `unique (entity_id, user_identifier, event_type, minute_bucket)` on the
  events table, with the app inserting via `ON CONFLICT DO NOTHING`. This
  makes the dedupe authoritative even under retries or race conditions,
  while the user-facing action (the click, the copy, the download) still
  fires every time.
- **RLS on every table.** The default shape: public/anon `select` on
  published or public-safe rows, `insert` open to anon only for event-log
  tables (never `select`/`update`/`delete`), and `authenticated`-only for
  everything else. Service-role (used by Edge Functions and this repo's
  server) bypasses RLS entirely, so it never needs its own policy.
- **Index what you'll actually query** — org+status composite indexes for
  list views, a `gin`/`to_tsvector` index for anything with a search screen,
  and an index on the event table's foreign key + timestamp for dashboard
  queries.

### 5. Commit

Stage exactly the new `apps/<app-slug>/` files and commit with a message
that names the app and the one-line purpose — no unrelated changes bundled
in. Follow this repo's normal git conventions (new commit, not amend; ask
before pushing if that's not already established for the session).

## When the app needs something the template doesn't cover

The template covers the shape every app in this repo needs (multi-tenant
scaffold, RLS, dedup pattern). It deliberately doesn't try to anticipate
every domain — a payments app needs different tables than a video archive.
Use your judgment on the app-specific tables and flows; the parts of this
skill that are load-bearing are the tenant scaffold, the RLS defaults, and
the dedup pattern, not the exact table names.
