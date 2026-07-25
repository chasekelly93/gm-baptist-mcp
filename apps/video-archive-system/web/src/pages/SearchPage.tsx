import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Search, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";

interface Category {
  id: string;
  name: string;
}

interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  category_id: string;
}

export function SearchPage() {
  const { orgId, anonId, user, orgError } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("video_categories")
      .select("id, name")
      .eq("org_id", orgId)
      .order("sort_order")
      .then(({ data }) => {
        if (data) setCategories(data);
      });
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;

    const fetchVideos = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from("videos")
          .select("id, title, description, thumbnail_url, category_id")
          .eq("org_id", orgId)
          .eq("status", "published");

        if (selectedCategory) {
          query = query.eq("category_id", selectedCategory);
        }

        if (debouncedSearch) {
          query = query.or(`title.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`);
        }

        const { data } = await query.order("created_at", { ascending: false });

        if (data) {
          setVideos(data);

          // Log search event if there's a text query
          if (debouncedSearch) {
            supabase.from("video_search_events").insert({
              org_id: orgId,
              query: debouncedSearch,
              result_count: data.length,
              searched_by: user?.id || anonId,
            }).then(); // fire and forget
          }
        }
      } catch (err) {
        console.error("Error fetching videos:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [debouncedSearch, selectedCategory, orgId, anonId, user]);

  if (orgError) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-destructive">
        <p>Error loading organization: {orgError}</p>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-8">
      <div className="space-y-4 text-center max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight">Video Knowledge Base</h1>
        <p className="text-lg text-muted-foreground">Search and discover internal training and onboarding videos.</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input
              className="pl-10 h-12 text-lg"
              placeholder="Search by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button asChild className="h-12 px-6">
            <Link to="/add">
              <Plus className="mr-2 h-5 w-5" />
              Add Video
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        <Badge
          variant={selectedCategory === null ? "default" : "secondary"}
          className="cursor-pointer text-sm px-3 py-1"
          onClick={() => setSelectedCategory(null)}
        >
          All
        </Badge>
        {categories.map((cat) => (
          <Badge
            key={cat.id}
            variant={selectedCategory === cat.id ? "default" : "secondary"}
            className="cursor-pointer text-sm px-3 py-1"
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.name}
          </Badge>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No videos found. Try adjusting your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <Link key={video.id} to={`/videos/${video.id}`} className="block group">
              <Card className="h-full transition-shadow hover:shadow-md overflow-hidden">
                {video.thumbnail_url ? (
                  <div className="aspect-video w-full overflow-hidden bg-muted">
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="aspect-video w-full bg-muted flex items-center justify-center text-muted-foreground">
                    No Thumbnail
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="line-clamp-2">{video.title}</CardTitle>
                  <CardDescription className="line-clamp-3">{video.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
