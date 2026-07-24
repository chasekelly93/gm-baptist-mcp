import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  loom_url: string;
  category: {
    name: string;
  } | null;
}

export function VideoDetailPage() {
  const { videoId } = useParams();
  const { orgId, anonId, user, orgError } = useAuth();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!orgId || !videoId) return;

    const fetchVideo = async () => {
      const { data } = await supabase
        .from("videos")
        .select(`
          id, title, description, thumbnail_url, loom_url,
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

      // Log view event
      const now = new Date();
      now.setSeconds(0, 0); // truncate to minute

      supabase.from("video_click_events").upsert({
        org_id: orgId,
        video_id: videoId,
        user_identifier: user?.id || anonId,
        source: "view",
        minute_bucket: now.toISOString()
      }, { onConflict: "video_id,user_identifier,source,minute_bucket", ignoreDuplicates: true })
      .then(({ error }) => {
        if (error) console.error("Failed to log view event:", error);
      });
    };

    fetchVideo();
  }, [orgId, videoId, anonId, user]);

  const handleCopy = async () => {
    if (!video || !orgId) return;

    try {
      await navigator.clipboard.writeText(video.loom_url);
      setCopied(true);
      toast.success("Copied!");
      setTimeout(() => setCopied(false), 2000);

      // Log copy event
      const now = new Date();
      now.setSeconds(0, 0); // truncate to minute

      supabase.from("video_click_events").upsert({
        org_id: orgId,
        video_id: video.id,
        user_identifier: user?.id || anonId,
        source: "copy_button",
        minute_bucket: now.toISOString()
      }, { onConflict: "video_id,user_identifier,source,minute_bucket", ignoreDuplicates: true })
      .then(({ error }) => {
        if (error) console.error("Failed to log copy event:", error);
      });

    } catch (err) {
      toast.error("Failed to copy link");
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
          {video.thumbnail_url ? (
            <div className="rounded-xl overflow-hidden border bg-muted aspect-video">
              <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="rounded-xl border bg-muted aspect-video flex items-center justify-center text-muted-foreground">
              No Thumbnail
            </div>
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
