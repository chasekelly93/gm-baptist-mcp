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
