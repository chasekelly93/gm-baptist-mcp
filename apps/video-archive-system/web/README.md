# Video Archive — web app

React + TypeScript + Vite + Tailwind v4, backed by Supabase. See
`../SPEC.md` for the product/technical spec and `../schema.sql` for the
database this app reads/writes.

## Setup

```bash
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

## Structure

- `src/pages/` — one file per screen (Search, Video Detail, Add Video,
  Categories, Dashboard, Staff Login).
- `src/hooks/` — Supabase data hooks (`useOrganization`, `useVideos`,
  `useCategories`, `useTrackEvent`, `useAuth`).
- `src/lib/` — Supabase client, shared types mirroring `schema.sql`, the
  anonymous device-id helper used for click/search dedupe.
- `src/components/` — shared UI (video card, category chips, copy button,
  nav bar, staff route guard).

## Backend

The "Analyze with AI" button in Add Video calls a Supabase Edge Function,
`analyze-loom-video` — see `../supabase/functions/analyze-loom-video/` for
its source and deploy instructions.
