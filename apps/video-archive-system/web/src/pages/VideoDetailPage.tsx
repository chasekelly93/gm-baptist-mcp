import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Copy, Check, Loader2, Play } from "lucide-react";
import { toast } from "sonner";

interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  loom_url: string;
  loom_video_id: string | null;
  category: {
    name: string;
  } | null;
}

// navigator.clipboard.writeText frequently throws inside sandboxed preview
// iframes (common for app-builder previews) due to the Clipboard API's
// permissions policy. Fall back to the older execCommand approach, which
// tends to work in more restrictive iframe contexts, before giving up.
async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error("navigator.clipboard.writeText failed, falling back:", err);
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textarea);
    return successful;
  } catch (err) {
    console.error("execCommand copy fallback also failed:", err);
    return false;
  }
}

export function VideoDetailPage() {
  const { videoId } = useParams();
  const { orgId, anonId, user, orgError } = useAuth();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!orgId || !videoId) return;

    const fetchVideo = async () => {
      const { data } = await supabase
        .from("videos")
        .select(`
          id, title, description, thumbnail_url, loom_url, loom_video_id,
          category:video_categories(name)
        `)
        .eq("id", videoId)
        .eq("org_id", orgId)
        .single();

      if (data) {
        // Supabase joins can return an array or single object depending on relationship.
        // category is a reference to video_categories.
        const formattedData = {
          ...data,
          category: Array.isArray(data.category) ? data.category[0] : data.category
        };
        setVideo(formattedData as Video);
      }
      setLoading(false);
      // Note: "view" is now logged when the visitor actually presses play
      // (see handlePlay), not just for landing on this page — a much more
      // meaningful engagement signal for the Dashboard's usage metrics.
    };

    fetchVideo();
  }, [orgId, videoId]);

  const logEvent = (source: "copy_button" | "view") => {
    if (!video || !orgId) return;
    const now = new Date();
    now.setSeconds(0, 0); // truncate to minute

    supabase.from("video_click_events").upsert({
      org_id: orgId,
      video_id: video.id,
      user_identifier: user?.id || anonId,
      source,
      minute_bucket: now.toISOString()
    }, { onConflict: "video_id,user_identifier,source,minute_bucket", ignoreDuplicates: true })
    .then(({ error }) => {
      if (error) console.error(`Failed to log ${source} event:`, error);
    });
  };

  const handleCopy = async () => {
    if (!video || !orgId) return;

    // Track the click regardless of whether the copy itself succeeds — the
    // button was pressed either way, and that's the signal we care about.
    logEvent("copy_button");

    const success = await copyToClipboard(video.loom_url);
    if (success) {
      setCopied(true);
      toast.success("Copied!");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Couldn't copy automatically — copy the link manually.");
    }
  };

  const handlePlay = () => {
    if (!video) return;
    logEvent("view");

    if (video.loom_video_id) {
      setIsPlaying(true);
    } else {
      // No loom_video_id captured (e.g. added manually without AI analysis)
      // — nothing to embed, so open Loom directly instead.
      window.open(video.loom_url, "_blank", "noopener,noreferrer");
    }
  };

  if (orgError) {
    return (
      <div className="container mx-auto p-6 max-w-4xl space-y-6">
        <div className="text-destructive">Error loading organization: {orgError}</div>
      </div>
    );
  }

  if (!orgId || loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl space-y-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="container mx-auto p-6 text-center py-20">
        <h2 className="text-2xl font-bold mb-2">Video not found</h2>
        <p className="text-muted-foreground mb-6">The video you're looking for doesn't exist or is not published.</p>
        <Button asChild>
          <Link to="/">Back to Search</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <Button variant="ghost" asChild className="-ml-4 mb-2 text-muted-foreground">
        <Link to="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Search
        </Link>
      </Button>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          {isPlaying && video.loom_video_id ? (
            <div className="rounded-xl overflow-hidden border bg-muted aspect-video">
              <iframe
                src={`https://www.loom.com/embed/${video.loom_video_id}`}
                allow="fullscreen; autoplay"
                allowFullScreen
                className="w-full h-full"
                title={video.title}
              />
            </div>
          ) : video.thumbnail_url ? (
            <button
              type="button"
              onClick={handlePlay}
              className="group relative block w-full overflow-hidden rounded-xl border bg-muted aspect-video"
              aria-label="Play video"
            >
              <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90">
                  <Play className="h-8 w-8 ml-1 text-black" fill="currentColor" />
                </div>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePlay}
              className="flex w-full items-center justify-center rounded-xl border bg-muted aspect-video text-muted-foreground"
              aria-label="Play video"
            >
              <Play className="mr-2 h-6 w-6" />
              Play video
            </button>
          )}

          <div>
            <div className="flex items-center gap-3 mb-3">
              {video.category && (
                <Badge variant="secondary">{video.category.name}</Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold mb-4">{video.title}</h1>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-lg text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {video.description}
              </p>
            </div>
          </div>
        </div>

        <div>
          <div className="sticky top-24 border rounded-xl p-6 bg-card shadow-sm space-y-4">
            <h3 className="font-semibold text-lg">Share this video</h3>
            <p className="text-sm text-muted-foreground">Copy the Loom link to share with your team.</p>
            <Button onClick={handleCopy} className="w-full" size="lg">
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
