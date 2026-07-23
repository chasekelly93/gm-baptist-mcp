import { supabase } from "./supabaseClient";
import { getDeviceId } from "./deviceId";

/**
 * Records a search query and how many results it returned. Powers the
 * "content gap" report on the Dashboard page — queries with low/zero
 * result_count are signals for what to catalog next (see SPEC.md §8).
 */
export async function logSearchEvent(
  orgId: string,
  query: string,
  resultCount: number,
  userId?: string,
) {
  if (!query.trim()) return;
  await supabase.from("video_search_events").insert({
    org_id: orgId,
    query: query.trim(),
    result_count: resultCount,
    searched_by: userId ?? getDeviceId(),
  });
}
