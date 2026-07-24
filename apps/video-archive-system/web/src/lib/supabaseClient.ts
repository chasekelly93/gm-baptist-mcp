import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — set them in .env (see .env.example).",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Every query in this app is scoped to a single org (see apps/video-archive-system/SPEC.md
// for why: this schema is shared across GM Baptist Outreach, Automate South, etc).
export const DEFAULT_ORG_SLUG =
  (import.meta.env.VITE_DEFAULT_ORG_SLUG as string | undefined) ??
  "gm_baptist_outreach";

// n8n webhook that drafts a title/description/category from a Loom link —
// see apps/video-archive-system/README or the n8n workflow export for what
// it expects/returns.
export const ANALYZE_LOOM_WEBHOOK_URL =
  (import.meta.env.VITE_ANALYZE_LOOM_WEBHOOK_URL as string | undefined) ??
  "https://n8n.gmbaptistoutreach.com/webhook/analyze-loom-video";
