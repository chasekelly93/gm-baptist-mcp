import { useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { getDeviceId, minuteBucket } from "../lib/deviceId";
import { useAuth } from "./useAuth";

/**
 * Logs a click/copy/view event, deduped per user per minute by the unique
 * constraint on video_click_events in schema.sql. The insert is fire-and-
 * forget from the UI's perspective — ON CONFLICT DO NOTHING means a rapid
 * double-click never throws and never double-counts, so callers don't need
 * to handle the conflict case themselves.
 */
export function useTrackEvent(orgId: string | null) {
  const { session } = useAuth();

  return useCallback(
    async (videoId: string, source: "copy_button" | "view") => {
      if (!orgId) return;
      const userIdentifier = session?.user.id ?? getDeviceId();

      await supabase.from("video_click_events").upsert(
        {
          org_id: orgId,
          video_id: videoId,
          user_identifier: userIdentifier,
          source,
          minute_bucket: minuteBucket(),
        },
        {
          onConflict: "video_id,user_identifier,source,minute_bucket",
          ignoreDuplicates: true,
        },
      );
    },
    [orgId, session],
  );
}
