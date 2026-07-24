import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useOrganization } from "../hooks/useOrganization";
import { useTrackEvent } from "../hooks/useTrackEvent";
import { CopyLinkButton } from "../components/CopyLinkButton";
import type { VideoWithCategory } from "../lib/types";

export function VideoDetailPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const { orgId } = useOrganization();
  const trackEvent = useTrackEvent(orgId);
  const [video, setVideo] = useState<VideoWithCategory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!videoId) return;
    supabase
      .from("videos")
      .select("*, video_categories(id, name, slug)")
      .eq("id", videoId)
      .single()
      .then(({ data }) => {
        setVideo(data as unknown as VideoWithCategory);
        setLoading(false);
      });
  }, [videoId]);

  useEffect(() => {
    if (video && orgId) trackEvent(video.id, "view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id, orgId]);

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;
  if (!video) return <p className="p-6 text-gray-400">Video not found.</p>;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-8">
      <Link to="/" className="text-sm text-gray-500">
        ← Back to search
      </Link>

      {video.video_categories && (
        <span className="w-fit rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
          {video.video_categories.name}
        </span>
      )}

      <h1 className="text-2xl font-bold">{video.title}</h1>
      {video.description && (
        <p className="text-gray-600 dark:text-gray-300">{video.description}</p>
      )}

      {video.thumbnail_url && (
        <a href={video.loom_url} target="_blank" rel="noreferrer">
          <img
            src={video.thumbnail_url}
            alt=""
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700"
          />
        </a>
      )}

      <div className="flex items-center gap-3">
        <CopyLinkButton orgId={orgId} videoId={video.id} loomUrl={video.loom_url} />
        <a
          href={video.loom_url}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-brand underline"
        >
          Open in Loom
        </a>
      </div>
    </div>
  );
}
