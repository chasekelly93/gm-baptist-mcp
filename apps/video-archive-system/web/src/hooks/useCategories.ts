import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { VideoCategory } from "../lib/types";

export function useCategories(orgId: string | null) {
  const [categories, setCategories] = useState<VideoCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("video_categories")
      .select("*")
      .eq("org_id", orgId)
      .order("sort_order", { ascending: true });
    if (!error && data) setCategories(data);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { categories, loading, refresh };
}
