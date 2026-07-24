import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, ExternalLink } from "lucide-react";

interface VideoStats {
  id: string;
  title: string;
  categoryName: string;
  allTime: number;
  last30Days: number;
  last7Days: number;
  prev7Days: number;
  trendingPercent: number;
}

interface CategoryStats {
  name: string;
  count: number;
}

interface SearchGap {
  query: string;
  count: number;
}

export function DashboardPage() {
  const { orgId, orgError } = useAuth();
  const [loading, setLoading] = useState(true);

  const [topVideos, setTopVideos] = useState<VideoStats[]>([]);
  const [candidates, setCandidates] = useState<VideoStats[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [searchGaps, setSearchGaps] = useState<SearchGap[]>([]);

  useEffect(() => {
    if (!orgId) return;

    const fetchDashboardData = async () => {
      setLoading(true);

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Fetch all videos
      const { data: videos } = await supabase
        .from("videos")
        .select("id, title, category:video_categories(name)")
        .eq("org_id", orgId);

      // Fetch all copy events
      const { data: copyEvents } = await supabase
        .from("video_click_events")
        .select("video_id, created_at")
        .eq("org_id", orgId)
        .eq("source", "copy_button");

      // Fetch search gaps
      const { data: searches } = await supabase
        .from("video_search_events")
        .select("query")
        .eq("org_id", orgId)
        .lte("result_count", 1);

      if (videos && copyEvents) {
        const statsMap = new Map<string, VideoStats>();
        const catMap = new Map<string, number>();

        videos.forEach(v => {
          const categoryData = v.category as unknown as { name: string } | { name: string }[] | null;
          const catName = Array.isArray(categoryData) ? categoryData[0]?.name : categoryData?.name;
          statsMap.set(v.id, {
            id: v.id,
            title: v.title,
            categoryName: catName || "Uncategorized",
            allTime: 0,
            last30Days: 0,
            last7Days: 0,
            prev7Days: 0,
            trendingPercent: 0
          });
        });

        copyEvents.forEach(evt => {
          const stat = statsMap.get(evt.video_id);
          if (!stat) return;

          const date = new Date(evt.created_at);
          stat.allTime++;

          if (date >= thirtyDaysAgo) stat.last30Days++;
          if (date >= sevenDaysAgo) stat.last7Days++;
          else if (date >= fourteenDaysAgo) stat.prev7Days++;

          // Add to category stats
          catMap.set(stat.categoryName, (catMap.get(stat.categoryName) || 0) + 1);
        });

        const statsArray = Array.from(statsMap.values()).map(stat => {
          if (stat.prev7Days > 0) {
            stat.trendingPercent = Math.round(((stat.last7Days - stat.prev7Days) / stat.prev7Days) * 100);
          } else if (stat.last7Days > 0) {
            stat.trendingPercent = 100;
          }
          return stat;
        });

        // Top videos sorted by allTime
        setTopVideos([...statsArray].sort((a, b) => b.allTime - a.allTime).slice(0, 10));

        // Candidates: last 30 days >= 10
        setCandidates(statsArray.filter(s => s.last30Days >= 10).sort((a, b) => b.last30Days - a.last30Days));

        // Category stats
        setCategoryStats(
          Array.from(catMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
        );
      }

      if (searches) {
        const gapMap = new Map<string, number>();
        searches.forEach(s => {
          const q = s.query.toLowerCase().trim();
          gapMap.set(q, (gapMap.get(q) || 0) + 1);
        });
        setSearchGaps(
          Array.from(gapMap.entries())
            .map(([query, count]) => ({ query, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
        );
      }

      setLoading(false);
    };

    fetchDashboardData();
  }, [orgId]);

  if (orgError) {
    return (
      <div className="container mx-auto p-6 max-w-6xl space-y-6">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
        <div className="text-destructive">Error loading organization: {orgError}</div>
      </div>
    );
  }

  if (loading || !orgId) {
    return (
      <div className="container mx-auto p-6 max-w-6xl space-y-6">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Insights on video usage and search gaps.</p>
      </div>

      {candidates.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-primary flex items-center gap-2">
              🔥 Live Session Candidates
            </CardTitle>
            <CardDescription>
              These videos have been copied 10+ times in the last 30 days, indicating high demand. Consider turning these topics into live onboarding sessions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {candidates.map(v => (
                <div key={v.id} className="flex items-center justify-between bg-background p-4 rounded-lg border">
                  <div>
                    <Link to={`/videos/${v.id}`} className="font-medium hover:underline flex items-center gap-2">
                      {v.title}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </Link>
                    <p className="text-sm text-muted-foreground">{v.categoryName}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">{v.last30Days}</div>
                    <div className="text-xs text-muted-foreground">copies (30d)</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Videos */}
        <Card>
          <CardHeader>
            <CardTitle>Top Videos by Copies</CardTitle>
            <CardDescription>Most shared videos across your organization.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topVideos.map(v => (
                <div key={v.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex-1 pr-4">
                    <Link to={`/videos/${v.id}`} className="font-medium text-sm hover:underline line-clamp-1">
                      {v.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{v.categoryName}</Badge>
                      {v.trendingPercent !== 0 && (
                        <span className={`text-xs flex items-center ${v.trendingPercent > 0 ? "text-green-600" : "text-red-600"}`}>
                          {v.trendingPercent > 0 ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                          {Math.abs(v.trendingPercent)}% (7d)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <div className="font-semibold">{v.allTime}</div>
                    <div className="text-[10px] text-muted-foreground">all-time</div>
                  </div>
                </div>
              ))}
              {topVideos.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">No data yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
              <CardDescription>Total copies grouped by category.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categoryStats.map(c => (
                  <div key={c.name} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{c.name}</span>
                    <Badge variant="outline">{c.count} copies</Badge>
                  </div>
                ))}
                {categoryStats.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">No data yet</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Search Gaps */}
          <Card>
            <CardHeader>
              <CardTitle>Search Gaps</CardTitle>
              <CardDescription>Frequent searches that returned 0 or 1 results.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {searchGaps.map(g => (
                  <Badge key={g.query} variant="secondary" className="px-3 py-1.5 flex items-center gap-2">
                    {g.query}
                    <span className="bg-background text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                      {g.count}
                    </span>
                  </Badge>
                ))}
                {searchGaps.length === 0 && (
                  <div className="text-sm text-muted-foreground py-4">No search gaps found!</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
