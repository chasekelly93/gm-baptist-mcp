import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { VideoStatus, VideoWithCategory } from "../lib/types";

interface UseVideosOptions {
  orgId: string | null;
  query?: string;
  categoryId?: string | null;
  statuses?: VideoStatus[];
}

/**
 * Search over title+description (backed by the gin index in schema.sql)
 * with an optional category filter. Pass statuses=['draft','published',
 * 'archived'] from staff-only screens; the public Search page should leave
 * it at the default (published only).
 */
export function useVideos({
  orgId,
  query = "",
  categoryId = null,
  statuses = ["published"],
}: UseVideosOptions) {
  const [videos, setVideos] = useState<VideoWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const statusKey = statuses.join(",");

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);

    let builder = supabase
      .from("videos")
      .select("*, video_categories(id, name, slug)")
      .eq("org_id", orgId)
      .in("status", statuses)
      .order("created_at", { ascending: false });

    if (categoryId) builder = builder.eq("category_id", categoryId);
    if (query.trim()) {
      const escaped = query.trim().replace(/[%_]/g, "\\$&");
      builder = builder.or(
        `title.ilike.%${escaped}%,description.ilike.%${escaped}%`,
      );
    }

    builder.then(({ data, error }) => {
      if (cancelled) return;
      if (!error && data) setVideos(data as unknown as VideoWithCategory[]);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // statusKey (not `statuses`) is the real dependency — the array's
    // identity changes every render via the default param, but its joined
    // contents don't, so this avoids an effect loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, query, categoryId, statusKey]);

  return { videos, loading };
}
