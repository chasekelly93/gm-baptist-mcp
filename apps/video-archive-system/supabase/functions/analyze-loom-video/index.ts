// Supabase Edge Function: analyze-loom-video
//
// Given a Loom share URL, drafts a title/description/category suggestion so
// staff can catalog a video by pasting a link instead of typing everything
// by hand. See apps/video-archive-system/SPEC.md §5.
//
// This never writes to the database — it only returns a draft. The caller
// (AddEditVideoPage) always shows the draft for human review before saving.
//
// Required secrets (set via `supabase secrets set`):
//   ANTHROPIC_API_KEY
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided automatically to
// every Edge Function.

import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  loom_url: string;
  org_id?: string;
}

interface LoomMeta {
  loom_video_id: string | null;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
}

function extractLoomVideoId(url: string): string | null {
  const match = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

async function fetchLoomMetadata(loomUrl: string): Promise<LoomMeta> {
  const loomVideoId = extractLoomVideoId(loomUrl);

  // oEmbed is Loom's public, unauthenticated metadata endpoint.
  let oembedTitle: string | null = null;
  let thumbnailUrl: string | null = null;
  try {
    const oembedRes = await fetch(
      `https://www.loom.com/v1/oembed?url=${encodeURIComponent(loomUrl)}`,
    );
    if (oembedRes.ok) {
      const oembed = await oembedRes.json();
      oembedTitle = oembed.title ?? null;
      thumbnailUrl = oembed.thumbnail_url ?? null;
    }
  } catch {
    // Non-fatal — fall through to page scrape / AI draft from URL alone.
  }

  // The share page's og:description is usually richer than oEmbed's.
  let ogDescription: string | null = null;
  try {
    const pageRes = await fetch(loomUrl);
    if (pageRes.ok) {
      const html = await pageRes.text();
      const descMatch = html.match(
        /<meta property="og:description" content="([^"]*)"/,
      );
      if (descMatch) ogDescription = descMatch[1];
      if (!thumbnailUrl) {
        const imgMatch = html.match(
          /<meta property="og:image" content="([^"]*)"/,
        );
        if (imgMatch) thumbnailUrl = imgMatch[1];
      }
    }
  } catch {
    // Non-fatal.
  }

  return {
    loom_video_id: loomVideoId,
    title: oembedTitle,
    description: ogDescription,
    thumbnail_url: thumbnailUrl,
  };
}

async function draftWithClaude(
  meta: LoomMeta,
  loomUrl: string,
  categoryNames: string[],
) {
  if (!ANTHROPIC_API_KEY) {
    // No AI key configured — return the raw metadata as a best-effort draft
    // so the form still gets pre-filled with *something* useful.
    return {
      title: meta.title ?? "Untitled video",
      description: meta.description ?? "",
      suggested_category: null,
      raw_summary: meta.description ?? "",
    };
  }

  const categoryList =
    categoryNames.length > 0
      ? `Existing categories: ${categoryNames.join(", ")}. If one clearly fits, return its exact name in suggested_category; otherwise return null.`
      : "No categories exist yet — return suggested_category as null.";

  const prompt = `You're cataloging an internal how-to video for a video knowledge base. Here's what's publicly available about it:

Loom URL: ${loomUrl}
Loom's own title: ${meta.title ?? "(none)"}
Loom's own description: ${meta.description ?? "(none)"}

Write a clear, specific title (under 80 chars) and a 1-2 sentence description of what the video covers and who'd need it. ${categoryList}

Respond with ONLY a JSON object, no markdown fences: {"title": string, "description": string, "suggested_category": string | null}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "{}";
  const parsed = JSON.parse(text);

  return {
    title: parsed.title ?? meta.title ?? "Untitled video",
    description: parsed.description ?? meta.description ?? "",
    suggested_category: parsed.suggested_category ?? null,
    raw_summary: text,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { loom_url, org_id }: RequestBody = await req.json();
    if (!loom_url) {
      return new Response(JSON.stringify({ error: "loom_url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const meta = await fetchLoomMetadata(loom_url);

    let categoryNames: string[] = [];
    let categorySlugBySame: Record<string, string> = {};
    if (org_id) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: categories } = await supabase
        .from("video_categories")
        .select("name, slug")
        .eq("org_id", org_id);
      categoryNames = (categories ?? []).map((c) => c.name);
      categorySlugBySame = Object.fromEntries(
        (categories ?? []).map((c) => [c.name, c.slug]),
      );
    }

    const draft = await draftWithClaude(meta, loom_url, categoryNames);

    const response = {
      title: draft.title,
      description: draft.description,
      suggested_category: draft.suggested_category
        ? (categorySlugBySame[draft.suggested_category] ?? null)
        : null,
      loom_video_id: meta.loom_video_id,
      thumbnail_url: meta.thumbnail_url,
      raw_summary: draft.raw_summary,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  }
});
