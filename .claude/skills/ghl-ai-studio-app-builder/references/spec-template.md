# {{App Name}}

One or two sentences: what this app is and who it's for. Built for GHL AI
Studio as a React + TypeScript + Vite web app (Tailwind), backed by
Supabase — see `web/` for the app.

Primary tenant: **{{org_name, e.g. GM Baptist Outreach}}**. The data model is
multi-tenant from day one so {{other org, e.g. Automate South}} (or any
future org) can run the same app without a schema migration — just a new
`organizations` row and org-scoped data. (The Supabase *project* itself may
still be dedicated to this app rather than shared — confirm per §9, don't
assume.)

## 1. Problem

What's broken, missing, or manual today that this app fixes. Be concrete —
name the actual pain, not a generic "we need better tooling."

## 2. Core goals

Numbered list, 3-6 items. Each one should be a concrete capability, not a
vague aspiration:

1. ...
2. ...

## 3. Non-goals (v1)

What's explicitly out of scope for the first version, and why (usually:
needs infrastructure/access we don't have yet, or is a "nice to have" that
would delay the core loop). Move genuine stretch ideas to §7 instead of
letting them creep into the v1 goals.

## 4. Data model (Supabase / Postgres)

See `schema.sql` in this directory for the runnable DDL. Summary:

| Table | Purpose |
|---|---|
| `organizations` | Tenant scaffold — one row per org. |
| `{{table}}` | ... |
| `{{events_table}}` | Event log for the metric this app cares about, deduped by `(entity_id, user_identifier, event_type, minute_bucket)`. |

### Dedup logic (if the app tracks repeated user actions)

Describe the specific action being deduped (a click, a copy, a view) and
confirm it uses the `unique (entity_id, user_identifier, event_type,
minute_bucket)` + `ON CONFLICT DO NOTHING` pattern from schema.sql, so the
metric is accurate even under rapid repeats or client retries, while the
user-facing action itself always still happens.

## 5. AI ingestion / automation flow (omit this section if not applicable)

If the app has a "paste X, get a cataloged/processed entry" flow, describe
it step by step: what's fetched automatically, what's sent to Claude and
with what context, and confirm a human reviews the draft before anything is
saved/published — don't auto-publish AI output. Note the env vars the flow
needs (typically `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` in an
Edge Function).

## 6. Web app (Vite + React + TypeScript) — pages

Bullet list, one per route, noting auth requirements:

- **{{Page name}}** (`{{route}}`) — what it shows/does. {{Public or
  staff-only (requires Supabase Auth)}}.

## 7. Phase 2 ideas (not building now)

Bullet list of genuine stretch goals raised during the idea discussion that
didn't make the v1 cut.

## 8. Metrics (omit if this app has no dashboard)

What the internal dashboard shows and why each metric matters — e.g. what
decision it's meant to inform (when a heavily-used item should graduate to
something more involved, where the content/data gaps are, etc).

## 9. GHL AI Studio / infra notes

- **Which Supabase project**: name it explicitly here (project ref/URL) and
  confirm it's actually accessible/correct before schema.sql is applied —
  don't assume it's shared with `gm-baptist-mcp` or any other app in this
  repo. State plainly if it's a dedicated project for this app.
- GHL AI Studio has no API to drive from this repo — the app is built
  directly in `apps/{{app-slug}}/web/` and wired to GHL AI Studio via its
  GitHub sync. State here which subfolder that sync should point at (not
  the repo root, which is the unrelated `gm-baptist-mcp` MCP server).
- Env vars for `web/` (see `web/.env.example`): `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY` (public, client-side — safe to expose),
  `VITE_DEFAULT_ORG_SLUG={{org_slug}}`.
- Secrets for any Edge Functions (never shipped to the browser):
  `SUPABASE_SERVICE_ROLE_KEY` (provided automatically), plus any
  app-specific ones (e.g. `ANTHROPIC_API_KEY`) set via `supabase secrets
  set`.
