import { useEffect, useState } from "react";
import { useOrganization } from "../hooks/useOrganization";
import { useCategories } from "../hooks/useCategories";
import { useVideos } from "../hooks/useVideos";
import { CategoryChips } from "../components/CategoryChips";
import { VideoCard } from "../components/VideoCard";
import { logSearchEvent } from "../lib/logSearchEvent";

export function SearchPage() {
  const { orgId } = useOrganization();
  const { categories } = useCategories(orgId);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const { videos, loading } = useVideos({ orgId, query, categoryId });

  // Log the search once results settle, debounced so we don't write an
  // event per keystroke — see SPEC.md's "search gaps" metric.
  useEffect(() => {
    if (!orgId || loading || !query.trim()) return;
    const timeout = setTimeout(() => {
      logSearchEvent(orgId, query, videos.length);
    }, 800);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, query, loading]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold">Find a video</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Search the catalog for the video a customer or teammate needs.
        </p>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by title or description…"
        className="rounded-md border border-gray-300 px-4 py-2 dark:border-gray-700 dark:bg-gray-900"
      />

      <CategoryChips
        categories={categories}
        activeId={categoryId}
        onSelect={setCategoryId}
      />

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : videos.length === 0 ? (
        <p className="text-gray-400">No videos found. Try a different search.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
