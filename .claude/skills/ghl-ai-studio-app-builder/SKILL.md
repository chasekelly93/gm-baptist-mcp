---
name: ghl-ai-studio-app-builder
description: >
  Scaffolds a new custom app for GHL AI Studio in this repo: a React +
  TypeScript + Vite web frontend (Tailwind) backed by Supabase, multi-tenant
  from day one via an organizations/org_id pattern so GM Baptist Outreach,
  Automate South, and any future org can share the same app and schema
  without a migration. Produces SPEC.md, schema.sql, a working web/ app, and
  (when needed) a supabase/functions/ Edge Function backend under
  apps/<app-slug>/, following the precedent already in
  apps/video-archive-system/. Use this skill whenever the user describes a
  new app idea meant for GHL AI Studio, says things like "build an app,"
  "scaffold a web app for GHL AI Studio," "create a new app idea," "I want
  an app that tracks/catalogs/manages X," or describes a tool for GM
  Baptist Outreach or Automate South that clearly needs its own screens and
  its own data — even if they never say "Vite," "Supabase," or "GHL AI
  Studio" explicitly. Reach for this skill before free-styling a one-off
  spec document or hand-rolling a frontend for a new app idea in this repo;
  it keeps every app's data model and stack consistent and reusable across
  orgs.
---

# GHL AI Studio App Builder

This repo (`gm-baptist-mcp`) is the GHL/Supabase integration layer for GM
Baptist Outreach, and it doubles as the home for spec-and-schema-first app
ideas meant to be built out in GHL AI Studio as web apps with Supabase as
the backend. `apps/video-archive-system/` is the reference implementation
of this pattern — when in doubt about a judgment call below, open that
folder and match what it did.

**GHL AI Studio's actual project scaffold is a Vite + React + TypeScript
web SPA** (Tailwind, shadcn-style component conventions), not React Native.
That was learned by inspecting a real AI Studio project export mid-build on
video-archive-system — trust this over anything else you've heard about
"GHL AI Studio apps" being mobile/React Native, unless the user explicitly
shows you otherwise for a specific project.

## Why this pattern, not a one-off

Every app built this way ends up needing the same three things: a place to
find the video/contact/whatever a person needs, a metric on how it's
actually used, and room for a second org (Automate South today, maybe others
later) to run the same app without anyone re-modeling the database. Baking
`organizations` / `org_id` into the schema on day one costs almost nothing
and avoids a real migration later — that's the main thing this skill exists
to enforce, along with keeping specs and stack choices consistent enough
that GHL AI Studio (or a future engineer) can pick any `apps/<slug>/` and
know exactly what's there and how it's wired.

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

If the user has already described all of this in the conversation, don't
re-ask — just confirm your understanding in a sentence before you start
writing files.

### 2. Confirm the Supabase project before writing or applying anything

Don't assume every app in this repo shares one Supabase project. When
video-archive-system was built, the Supabase project already connected to
this session (`Destination-Church`) turned out to belong to a *different*,
already-live app entirely (member assessments, pledges) — not the one this
repo's `seed-supabase.js`/`sync.js` use, and not the one the user actually
wanted. Applying a new schema to the wrong live database is a real-world,
hard-to-fully-reverse mistake, so before running any DDL:

1. List accessible Supabase projects/orgs and cross-check against what this
   repo's existing code expects (e.g. does a `clients` table exist where
   you'd expect it?).
2. If there's any mismatch or ambiguity, **ask the user** for the specific
   project ref/URL rather than guessing, and confirm you actually have
   access to it (a project ref that 403s or 404s under your current
   Supabase connection means it's a different account/org — say so plainly
   and ask the user to either grant access or run the SQL themselves).
3. Once confirmed, treat that project as this app's backend — it does not
   need to be the same Supabase project other apps in this repo use.

### 3. Create the app folder

`apps/<app-slug>/` at the repo root, where `<app-slug>` is a short kebab-case
name for the app (e.g. `video-archive-system`, `event-rsvp-tracker`).
Contents:

- `SPEC.md` — the product/technical spec (step 4).
- `schema.sql` — the runnable Supabase DDL (step 5).
- `web/` — the actual Vite + React + TypeScript app (step 6). Scaffold it
  for real with `npm create vite@latest web -- --template react-ts`, don't
  hand-write a fake-looking file tree.
- `supabase/functions/<function-name>/` — any Edge Function backends the
  app needs (e.g. an AI-drafting flow), only if the app actually needs
  server-side logic beyond what RLS + the anon key can do directly.

### 4. Write SPEC.md

Use `references/spec-template.md` as the structural skeleton. Fill in every
section; don't leave placeholder text in the final file. In particular,
make sure the spec covers:

- Problem, goals, non-goals (from step 1).
- A **data model summary table** — one row per table, one sentence per row
  on what it's for. This is the fast-reference a reader hits before diving
  into `schema.sql`.
- Any AI-assist or automation flow the app needs (not every app needs one —
  video-archive-system's Loom-link-to-metadata flow is an example of the
  shape this takes when it applies: fetch what's publicly available, hand it
  to Claude with relevant context, return a draft for human review, never
  auto-publish).
- The **page/route list** — one bullet per page, noting which ones require
  auth (staff-only) vs. which are public/self-service.
- **Multi-tenancy / RLS notes** — how `org_id` scopes the data, and in plain
  terms what's publicly readable vs. staff-only vs. service-role-only.
- **GHL AI Studio / infra notes** — which Supabase project this app uses
  (per step 2 — don't assume reuse), the env vars `web/` needs, and where
  GHL AI Studio's GitHub sync should point (a subfolder of this repo, e.g.
  `apps/<slug>/web/` — **not the repo root**, which is the unrelated
  `gm-baptist-mcp` MCP server's `package.json`/`src/`; confirm the sync
  path with the user if it isn't set up yet rather than guessing).

### 5. Write schema.sql

Use `references/schema-template.sql` as the starting point — it has the
`organizations` scaffold and the standard RLS shape already worked out, with
placeholders for the app's own tables. A few rules that apply to every app
built with this skill, not just the reference example:

- **Every table the app owns carries `org_id references organizations(id)`.**
  No exceptions, even if only one org uses the app today — this is the
  entire point of the pattern.
- **Seed the `organizations` row** for whichever org this app is for, via
  `on conflict (slug) do nothing` so re-running the script is always safe.
- **Dedup noisy event tables at the database level, not just in the client.**
  Any time the app logs a repeated user action (clicks, views, opens) that
  needs to be counted without noise from rapid repeats, use:
  `unique (entity_id, user_identifier, event_type, minute_bucket)` on the
  events table, with the app inserting via `upsert(..., { onConflict: ...,
  ignoreDuplicates: true })` (Supabase JS) so it never throws on a rapid
  repeat and never double-counts. The user-facing action (the click, the
  copy, the download) still fires every time regardless of whether the
  metric row was deduped.
- **RLS on every table.** The default shape: public/anon `select` on
  published or public-safe rows, `insert` open to anon only for event-log
  tables (never `select`/`update`/`delete`), and `authenticated`-only for
  everything else. Service-role (used by Edge Functions) bypasses RLS
  entirely, so it never needs its own policy.
- **Index what you'll actually query** — org+status composite indexes for
  list views, a `gin`/`to_tsvector` index for anything with a search screen
  (note: PostgREST's `.textSearch()` needs a matching single-column
  `to_tsvector`, not a multi-column expression index — if you're combining
  title+description, a simpler `ilike` OR-filter is often more correct for
  a v1 than fighting that mismatch), and an index on the event table's
  foreign key + timestamp for dashboard queries.
- After applying, verify with SQL you hand the user directly (see step 8)
  rather than a "go check the dashboard" instruction.

### 6. Build the web app for real, and validate it

Don't just describe the frontend — build it, and prove it works before
calling it done:

- Scaffold with real tooling (`npm create vite@latest web -- --template
  react-ts`), then add what the app needs: `@supabase/supabase-js`,
  `react-router-dom`, `tailwindcss` + `@tailwindcss/postcss` (Tailwind v4 —
  check the installed version before reaching for a v3-style
  `tailwind.config.js`/`autoprefixer` setup, they're not needed in v4).
- Structure: `src/pages/` (one file per route), `src/hooks/` (Supabase data
  hooks), `src/lib/` (Supabase client, shared types mirroring `schema.sql`,
  the anonymous device-id helper for dedupe), `src/components/` (shared UI).
- Read env vars via `import.meta.env.VITE_*` (Vite convention) and ship a
  `.env.example` — and make sure `.env`/`.env.local` are gitignored (the
  default Vite `.gitignore` often doesn't include them; add it).
- Run `npm run build` (typecheck + bundle) and the project's linter, and
  fix everything before moving on — a scaffold that doesn't compile isn't
  an initial version of anything.
- Then actually run it: start the dev server and load it in a real browser
  (Playwright is fine for this) — check that routing works, that
  auth-gated pages redirect when logged out, and that there are no console
  errors beyond expected network failures from placeholder credentials.
  Screenshot it. This is the same "start the dev server and use the
  feature" expectation that applies to any frontend work, not a
  skill-specific extra step.

### 7. Write the backend (Edge Functions), if the app needs one

Only needed when the app needs server-side logic the anon key + RLS can't
do — e.g. calling a paid AI API with a secret key. `analyze-loom-video` in
`apps/video-archive-system/supabase/functions/` is the reference: fetch
whatever public metadata is available, hand it to Claude with relevant
context, return a draft — the function never writes to the database itself,
the frontend always shows the draft for human review before saving. Keep
secrets (`ANTHROPIC_API_KEY`, etc.) as Supabase Edge Function secrets, never
in the `web/` app's env (anything under `VITE_*` ships to the browser).

### 8. Verification: always hand over runnable SQL, not dashboard steps

When the user needs to confirm something in Supabase (tables created, seed
row present, RLS on), give them the exact `select`/`information_schema`
query to paste into the SQL Editor and what result to expect — don't
describe a Table Editor click-path. This is faster for the user to run,
faster to interpret ("all five columns true" beats "go look and see"), and
gives you something concrete to check their pasted-back results against.

### 9. Commit

Stage exactly the new `apps/<app-slug>/` files and commit with a message
that names the app and the one-line purpose — no unrelated changes bundled
in. Follow this repo's normal git conventions (new commit, not amend; ask
before pushing if that's not already established for the session).

## When the app needs something the template doesn't cover

The template covers the shape every app in this repo needs (multi-tenant
scaffold, RLS, dedup pattern, Vite/Supabase wiring). It deliberately doesn't
try to anticipate every domain — a payments app needs different tables than
a video archive. Use your judgment on the app-specific tables, pages, and
flows; the parts of this skill that are load-bearing are the tenant
scaffold, the RLS defaults, the dedup pattern, the real-stack build
validation, and confirming the Supabase project before touching it — not
the exact table or page names.
