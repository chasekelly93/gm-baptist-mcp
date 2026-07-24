Build a video archive and analytics web app called "Video Archive." It's an
internal knowledge base for cataloging Loom recordings, tracking which ones
actually get reused, and surfacing which topics are popular enough to
justify turning into a full live onboarding session.

## Backend already exists — do not create your own schema

This app has an existing Supabase project and an existing Postgres schema
that's already applied and populated. Connect to it and use these exact
tables — do not invent new tables or rename columns.

**Connection:**
- `VITE_SUPABASE_URL=https://xbxwvfnrqrjobalkmbeu.supabase.co`
- `VITE_SUPABASE_ANON_KEY=` (fill in from Supabase dashboard → Project Settings → API → anon public key)

**Tables:**

```sql
organizations (
  id uuid primary key,
  slug text unique,        -- e.g. 'gm_baptist_outreach'
  name text,
  created_at timestamptz
)

video_categories (
  id uuid primary key,
  org_id uuid references organizations(id),
  name text,
  slug text,
  description text,
  sort_order int,
  created_at timestamptz
)

videos (
  id uuid primary key,
  org_id uuid references organizations(id),
  category_id uuid references video_categories(id),  -- nullable
  title text,
  description text,
  loom_url text,
  loom_video_id text,       -- nullable
  thumbnail_url text,       -- nullable
  ai_generated boolean,     -- true if title/description came from the AI draft flow
  ai_raw_summary text,      -- nullable
  status text,              -- 'draft' | 'published' | 'archived'
  created_by uuid,          -- references auth.users(id), nullable
  created_at timestamptz,
  updated_at timestamptz
)

video_click_events (
  id uuid primary key,
  org_id uuid references organizations(id),
  video_id uuid references videos(id),
  user_identifier text,     -- auth.uid() for staff, or a persisted anonymous device UUID for public visitors
  source text,              -- 'copy_button' | 'view'
  minute_bucket timestamptz,
  created_at timestamptz,
  -- UNIQUE constraint on (video_id, user_identifier, source, minute_bucket) already exists in the DB
)

video_search_events (
  id uuid primary key,
  org_id uuid references organizations(id),
  query text,
  result_count int,
  clicked_video_id uuid references videos(id),  -- nullable
  searched_by text,
  created_at timestamptz
)
```

**Row Level Security is already configured** — these are the exact policies
in place, so build the app to work within them rather than assuming
anything broader:

| Table | Policy | Who | Effect |
|---|---|---|---|
| `videos` | `public read published videos` | anon | `select` where `status = 'published'` |
| `videos` | `authenticated manage videos` | authenticated | full `select`/`insert`/`update`/`delete` |
| `video_categories` | `public read categories` | anon | `select` all rows |
| `video_categories` | `authenticated manage categories` | authenticated | full `select`/`insert`/`update`/`delete` |
| `video_click_events` | `public insert click events` | anon | `insert` only — no read/update/delete |
| `video_click_events` | `authenticated read click events` | authenticated | `select` only |
| `video_search_events` | `public insert search events` | anon | `insert` only — no read/update/delete |
| `video_search_events` | `authenticated read search events` | authenticated | `select` only |
| `organizations` | (no RLS / open read) | anon + authenticated | `select` — needed to look up the org id by slug |

In practice: public visitors get read-only catalog access (published videos
+ categories) plus write-only event logging (they can log a click/search
but never read the event tables back — that's staff-only, on the
Dashboard). Logged-in staff get full management access to videos and
categories, plus read access to the event tables for the Dashboard.

**Multi-tenant note**: there's only one organization row right now
(`slug = 'gm_baptist_outreach'`), but the schema supports more than one.
Every query should filter by this org's `id` (look it up once from the
`organizations` table by slug — don't hardcode the UUID) rather than
assuming there's only ever one row.

## The one thing that matters most: deduped copy tracking

Every video has a **Copy Link** button. Clicking it must always copy the
Loom URL to the clipboard and show a "Copied!" confirmation — that never
fails. Separately, it should log a row into `video_click_events` with
`source = 'copy_button'` and `minute_bucket` set to the current time
truncated to the minute (zero out seconds/ms). Insert this with upsert /
"on conflict do nothing" semantics against the existing unique constraint,
so if the same user clicks multiple times within the same minute, only the
first insert actually lands — this is how the app avoids inflating the
"most used" metric with accidental double-clicks, without ever blocking or
slowing down the copy action itself.

For anonymous (not logged-in) visitors, generate a random UUID the first
time they load the app, store it in `localStorage`, and reuse it as
`user_identifier` on every event from that browser. For logged-in staff,
use their Supabase auth user id instead.

## AI drafting flow — already built, call this webhook

There's an existing n8n workflow that drafts a title/description/category
from a Loom link. Don't build your own AI-calling logic for this — just
call the webhook:

- **POST** `https://n8n.gmbaptistoutreach.com/webhook/analyze-loom-video`
- **Request body**: `{ "loom_url": string, "category_names": string[] }`
  (send the names of the org's existing categories so it can suggest one
  that already exists)
- **Response body**: `{ "title": string, "description": string, "suggested_category": string | null, "loom_video_id": string | null, "thumbnail_url": string | null, "raw_summary": string }`
  (`suggested_category` is a category **name**, not an id — match it
  against the categories you already loaded)

This call only returns a draft. Never save anything automatically — the
draft fills in the Add Video form's fields for a human to review, edit, and
explicitly save.

**Real example, already tested and working** — request:

```json
{
  "loom_url": "https://www.loom.com/share/88b0f512eea04b508c7c33df64a63a30",
  "category_names": ["Contacts", "Pipelines", "Billing"]
}
```

response:

```json
{
  "title": "Pledge Form and Admin Portal Overview",
  "description": "Learn how to use the pledge submission form to collect donor information and access the admin portal to view pledge totals, donor lists, and export data. Essential for administrators managing pledge campaigns and tracking donations.",
  "suggested_category": "Pipelines",
  "loom_video_id": "88b0f512eea04b508c7c33df64a63a30",
  "thumbnail_url": "https://cdn.loom.com/sessions/thumbnails/88b0f512eea04b508c7c33df64a63a30-9bbb45b140ae64a1.gif",
  "raw_summary": "```json\n{\"title\": \"Pledge Form and Admin Portal Overview\", ...}\n```"
}
```

A request can take a few seconds (it fetches Loom's metadata, then calls
Claude) — show a loading state on the "Analyze with AI" button while
waiting, and if the request fails, don't block the form: let staff fill in
title/description/category by hand instead.

## Pages

1. **Search / home (`/`)** — public, no login required. A search box
   (matches against video title and description) and category filter
   chips, showing a grid/list of published videos only. Clicking a video
   opens its detail page.

2. **Video Detail (`/videos/:videoId`)** — public. Shows title,
   description, category, thumbnail (if present), and the **Copy Link**
   button described above. Log a `source = 'view'` event (same dedupe
   logic) when this page loads.

3. **Add Video (`/add`)** — staff-only (redirect to Staff Login if not
   authenticated). A Loom URL field with an "Analyze with AI" button that
   calls the webhook above and fills in the title/description/category
   fields as an editable draft. Below that, editable title and description
   fields, and a category picker that also lets staff type a new category
   name and create it inline (no separate categories management page
   needed — this single "create category on the fly" affordance is
   enough). Two save buttons: "Save as draft" and "Publish", which insert
   into `videos` with the corresponding `status`.

4. **Dashboard (`/dashboard`)** — staff-only. Shows:
   - **Top videos by copies** — copy counts per video, last 30 days and
     all-time, sorted descending.
   - **Trending** — which videos' copy counts are rising, comparing the
     last 7 days against the 7 days before that (e.g. a % change or simple
     up/down indicator per video).
   - **Onboarding session candidates** — a called-out list of videos whose
     30-day copy count crosses a threshold (start with 10 as a hardcoded
     constant), labeled as "reused often enough to consider a live
     session."
   - **Category breakdown** — total copies grouped by category, so staff
     can see which functional area gets reused the most.
   - **Search gaps** — from `video_search_events`, queries that returned 0
     or 1 results, with how many times each was searched — signals what to
     catalog next.

5. **Staff Login (`/staff-login`)** — a single email field that sends a
   Supabase magic link (`supabase.auth.signInWithOtp`). No password.

## Design

Clean and simple — this is an internal tool, not a marketing site.
Light/dark mode is a nice-to-have, not required. No need for a heavy design
system; plain, readable layout with clear typography is enough. Use
whatever component/styling conventions this project already has.
