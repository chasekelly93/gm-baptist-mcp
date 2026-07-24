import { useEffect, useState } from "react";
import { supabase, DEFAULT_ORG_SLUG } from "../lib/supabaseClient";

/**
 * Resolves the current org's UUID from its slug. Every other query in the
 * app filters by this id — see apps/video-archive-system/schema.sql.
 */
export function useOrganization(slug: string = DEFAULT_ORG_SLUG) {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .single()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
        } else {
          setOrgId(data.id);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { orgId, loading, error };
}
