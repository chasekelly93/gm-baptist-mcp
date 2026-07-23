# Video Archive & Analytics System

A searchable video knowledge base for cataloging Loom recordings, tracking which
ones actually get used, and surfacing candidates for turning into full onboarding
sessions. Built as a React Native (Expo) app for GHL AI Studio, backed by Supabase.

Primary tenant at launch: **GM Baptist Outreach**. The data model is multi-tenant
from day one so **Automate South** (or any future org) can run the same app on
the same Supabase project without a schema migration — just a new `organizations`
row and org-scoped data.

## 1. Problem

Loom links for how-to videos live scattered across Slack, docs, and memory.
There's no single place to find "the video for X," no way to see which videos
people actually use, and no signal for when a topic is popular enough to
justify building a real onboarding session around it.

## 2. Core goals

1. Catalog videos (title, description, Loom link, category) in one searchable place.
2. Let staff paste a Loom link and have AI draft the title/description/category
   so cataloging is nearly zero-effort.
3. Track "Copy Link" usage per video, deduped per user per minute, as the core
   usage signal.
4. Give staff a self-service search so anyone (internally, and eventually
   customers) can find the video they need without asking someone.
5. Give internal staff a metrics dashboard: most-copied videos, trending
   videos, and a flagged list of videos popular enough to warrant a full
   onboarding session.
6. Keep the data model multi-tenant so Automate South can reuse the same app.

## 3. Non-goals (v1)

- No automatic transcription/deep content analysis of the video itself — Loom's
  public surface (oEmbed + page metadata) is the only thing pulled without a
  Loom Enterprise API key. Deeper transcript-based analysis is a Phase 2 item
  (see §7).
- No auto-publish of AI-drafted metadata — a human always reviews/edits before
  a video goes live.
- No cross-org video sharing in v1; each org's catalog is isolated by `org_id`.

## 4. Data model (Supabase / Postgres)

See `schema.sql` in this directory for the runnable DDL. Summary:

| Table | Purpose |
|---|---|
| `organizations` | Tenant scaffold — one row per org (`gm_baptist_outreach`, later `automate_south`). |
| `video_categories` | Org-scoped taxonomy for the knowledge base (e.g. "Contacts", "Pipelines", "Billing"). |
| `videos` | The catalog entry: title, description, Loom URL, category, status, whether metadata was AI-generated. |
| `video_click_events` | One row per "Copy Link" (or view) event, deduped by `(video_id, user_identifier, source, minute_bucket)`. |
| `video_search_events` | One row per search query, with result count and (optionally) which video the user clicked — powers "content gap" reporting. |

### Dedup logic (the "no noise" requirement)

Every click event is written with `minute_bucket = date_trunc('minute', now())`
and a `unique (video_id, user_identifier, source, minute_bucket)` constraint.
The client always attempts the insert with `ON CONFLICT DO NOTHING`; the copy
action and clipboard write happen every time (so the user experience is
unaffected), but the metric only increments once per user per video per
minute, even under rapid double-clicks or retried requests. This makes the
dedupe authoritative at the database level, not just a client-side debounce.

`user_identifier` is `auth.uid()` for logged-in staff, or a persisted
anonymous device UUID (stored in `SecureStore`/`localStorage`) for self-serve,
unauthenticated visitors.

## 5. AI ingestion flow ("paste a link, get a catalog entry")

1. Staff pastes a Loom share URL into the "Add Video" screen and taps
   **Analyze with AI**.
2. A Supabase Edge Function (`analyze-loom-video`):
   - Fetches Loom's public oEmbed endpoint (`https://www.loom.com/v1/oembed?url=...`)
     for title, author, and thumbnail.
   - Fetches the Loom share page and reads `og:title` / `og:description` meta
     tags as a fallback/supplement (Loom's public oEmbed description is often
     empty).
   - Sends that metadata to Claude (Anthropic API) with the org's existing
     category list, asking for: a clean title, a 1–2 sentence description of
     what the video covers and its use case, and a suggested category (or
     "new category" if nothing fits).
   - Returns the draft to the app — nothing is saved yet.
3. Staff reviews the draft in the Add/Edit Video form, edits anything, picks
   the final category, and saves. This also covers the "single install, just
   fill in name/title/description and categorize" manual path — AI-assist is
   optional, not required, on the same screen.

Env vars needed for this function: `SUPABASE_SERVICE_ROLE_KEY`,
`ANTHROPIC_API_KEY`.

## 6. React Native app (Expo) — screens

- **Search / Home** — search bar, category filter chips, results list/grid.
  Public-facing, no login required (self-service).
- **Video Detail** — title, description, category tag, thumbnail, embedded
  Loom preview, and the **Copy Link** button (writes the click event and
  copies the Loom URL to clipboard).
- **Add / Edit Video** (staff-only, requires Supabase Auth) — Loom URL field,
  "Analyze with AI" action, editable title/description, category picker
  (with "add new category" inline), status (draft/published/archived).
- **Categories** (staff-only) — manage the taxonomy per org.
- **Dashboard** (staff-only) — see §8.

Auth: Supabase Auth (magic link) gates the staff screens; Search and Video
Detail use the anon key and RLS policies that only expose `status = 'published'`
rows.

## 7. Phase 2 ideas (not building now)

- Pull Loom captions/transcript (requires Loom Enterprise API or a
  download-and-transcribe step) for deeper AI summaries and full-text search
  inside the video content, not just title/description.
- Cross-org shared category library so Automate South and GM Baptist Outreach
  can optionally align on taxonomy.
- Customer-facing embed of Search inside a GHL location as a self-service
  help widget.

## 8. Metrics & the "move this to onboarding" signal

Dashboard (staff-only) queries against `video_click_events`:

- **Top videos** — copy counts all-time / 7d / 30d, sorted descending.
- **Trending** — week-over-week % change in copies per video.
- **Onboarding candidates** — videos whose 30-day copy count crosses a
  configurable threshold get flagged in a dedicated list: "This video is
  being reused often enough to justify a live onboarding session." Threshold
  is a simple constant to start (e.g. top decile or an absolute count); can
  become a per-org setting later.
- **Search gaps** — from `video_search_events`, queries with low/zero
  `result_count` surface as "people are searching for this and not finding
  it" — a signal for what to catalog next.
- **Category breakdown** — copy volume by category, to see which functional
  area drives the most reuse.

## 9. GHL AI Studio / infra notes

- Reuses the Supabase project already wired up for `gm-baptist-mcp`
  (`SUPABASE_URL` / `SUPABASE_SERVICE_KEY` already exist in this repo's env) —
  no new Supabase project needed, just the new tables in `schema.sql`, scoped
  by `org_id` so it never collides with the existing `clients` table or GHL
  sync data.
- Ship as an Expo-based React Native app per GHL AI Studio's app model;
  Search/Video Detail can also run as `expo export:web` if it needs to be
  embedded as a GHL custom menu link/iframe.
- Env vars for the app: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (public,
  client-side), `SUPABASE_SERVICE_ROLE_KEY` (Edge Functions only, never
  shipped in the app bundle), `ANTHROPIC_API_KEY` (Edge Function only),
  `DEFAULT_ORG_SLUG=gm_baptist_outreach` for this build.
