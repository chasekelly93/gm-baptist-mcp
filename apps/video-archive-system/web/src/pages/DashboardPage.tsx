import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useOrganization } from "../hooks/useOrganization";

// Videos with 30-day copies at or above this count are flagged as
// candidates for a full onboarding session — see SPEC.md §8. Simple
// constant for now; can become a per-org setting later.
const ONBOARDING_THRESHOLD = 10;

interface VideoStat {
  video_id: string;
  title: string;
  copies_30d: number;
  copies_all_time: number;
}

interface SearchGap {
  query: string;
  count: number;
  avg_results: number;
}

export function DashboardPage() {
  const { orgId } = useOrganization();
  const [stats, setStats] = useState<VideoStat[]>([]);
  const [gaps, setGaps] = useState<SearchGap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    Promise.all([
      supabase
        .from("video_click_events")
        .select("video_id, created_at, videos(title)")
        .eq("org_id", orgId)
        .eq("source", "copy_button"),
      supabase
        .from("video_search_events")
        .select("query, result_count")
        .eq("org_id", orgId)
        .lte("result_count", 1),
    ]).then(([clicksRes, searchRes]) => {
      const byVideo = new Map<string, VideoStat>();
      for (const row of clicksRes.data ?? []) {
        const title =
          (row as unknown as { videos: { title: string } | null }).videos
            ?.title ?? "(deleted video)";
        const existing = byVideo.get(row.video_id) ?? {
          video_id: row.video_id,
          title,
          copies_30d: 0,
          copies_all_time: 0,
        };
        existing.copies_all_time += 1;
        if (row.created_at >= thirtyDaysAgo) existing.copies_30d += 1;
        byVideo.set(row.video_id, existing);
      }

      const byQuery = new Map<string, { count: number; total: number }>();
      for (const row of searchRes.data ?? []) {
        const existing = byQuery.get(row.query) ?? { count: 0, total: 0 };
        existing.count += 1;
        existing.total += row.result_count;
        byQuery.set(row.query, existing);
      }

      setStats(
        [...byVideo.values()].sort((a, b) => b.copies_30d - a.copies_30d),
      );
      setGaps(
        [...byQuery.entries()]
          .map(([query, v]) => ({
            query,
            count: v.count,
            avg_results: v.total / v.count,
          }))
          .sort((a, b) => b.count - a.count),
      );
      setLoading(false);
    });
  }, [orgId]);

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  const onboardingCandidates = stats.filter(
    (s) => s.copies_30d >= ONBOARDING_THRESHOLD,
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {onboardingCandidates.length > 0 && (
        <section className="rounded-lg border border-brand/30 bg-brand/5 p-4">
          <h2 className="font-semibold text-brand">
            Onboarding session candidates
          </h2>
          <p className="mb-2 text-sm text-gray-500">
            Copied {ONBOARDING_THRESHOLD}+ times in the last 30 days — reused
            often enough to consider a live session.
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {onboardingCandidates.map((s) => (
              <li key={s.video_id}>
                {s.title} — {s.copies_30d} copies (30d)
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Top videos by copies</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-gray-400">
            <tr>
              <th className="py-1">Video</th>
              <th className="py-1">Last 30 days</th>
              <th className="py-1">All time</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.video_id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-1">{s.title}</td>
                <td className="py-1">{s.copies_30d}</td>
                <td className="py-1">{s.copies_all_time}</td>
              </tr>
            ))}
            {stats.length === 0 && (
              <tr>
                <td colSpan={3} className="py-3 text-gray-400">
                  No copy events logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Search gaps</h2>
        <p className="mb-2 text-sm text-gray-500">
          Queries that returned 0–1 results — signals for what to catalog
          next.
        </p>
        <table className="w-full text-left text-sm">
          <thead className="text-gray-400">
            <tr>
              <th className="py-1">Query</th>
              <th className="py-1">Times searched</th>
            </tr>
          </thead>
          <tbody>
            {gaps.map((g) => (
              <tr key={g.query} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-1">{g.query}</td>
                <td className="py-1">{g.count}</td>
              </tr>
            ))}
            {gaps.length === 0 && (
              <tr>
                <td colSpan={2} className="py-3 text-gray-400">
                  No search gaps yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
