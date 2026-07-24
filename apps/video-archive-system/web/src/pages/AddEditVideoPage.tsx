import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Wand2 } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

export function AddEditVideoPage() {
  const { orgId, user } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loomUrl, setLoomUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  // AI metadata
  const [loomVideoId, setLoomVideoId] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [aiRawSummary, setAiRawSummary] = useState<string | null>(null);
  const [aiGenerated, setAiGenerated] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("video_categories")
      .select("id, name")
      .eq("org_id", orgId)
      .order("name")
      .then(({ data }) => {
        if (data) setCategories(data);
      });
  }, [orgId]);

  const handleAnalyze = async () => {
    if (!loomUrl) {
      toast.error("Please enter a Loom URL first");
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch("https://n8n.gmbaptistoutreach.com/webhook/analyze-loom-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loom_url: loomUrl,
          category_names: categories.map(c => c.name)
        })
      });

      if (!response.ok) throw new Error("Failed to analyze video");

      const data = await response.json();

      setTitle(data.title || "");
      setDescription(data.description || "");
      setLoomVideoId(data.loom_video_id || null);
      setThumbnailUrl(data.thumbnail_url || null);
      setAiRawSummary(data.raw_summary || null);
      setAiGenerated(true);

      if (data.suggested_category) {
        const matched = categories.find(c => c.name.toLowerCase() === data.suggested_category.toLowerCase());
        if (matched) {
          setCategoryId(matched.id);
          setIsCreatingCategory(false);
        } else {
          setCategoryId("new");
          setNewCategoryName(data.suggested_category);
          setIsCreatingCategory(true);
        }
      }

      toast.success("Analysis complete! Review the draft below.");
    } catch (err) {
      toast.error("AI analysis failed. You can fill the details manually.");
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async (status: "draft" | "published") => {
    if (!title || !loomUrl || !orgId) {
      toast.error("Title and Loom URL are required");
      return;
    }

    setIsSaving(true);
    try {
      let finalCategoryId = categoryId;

      // Handle new category creation
      if (categoryId === "new" || isCreatingCategory) {
        if (!newCategoryName) {
          toast.error("Category name is required");
          setIsSaving(false);
          return;
        }

        const { data: newCat, error: catError } = await supabase
          .from("video_categories")
          .insert({
            org_id: orgId,
            name: newCategoryName,
            slug: newCategoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-")
          })
          .select()
          .single();

        if (catError) throw catError;
        finalCategoryId = newCat.id;
      }

      // Generate a new UUID for the video
      const videoId = crypto.randomUUID();

      const { error } = await supabase.from("videos").insert({
        id: videoId,
        org_id: orgId,
        title,
        description,
        loom_url: loomUrl,
        category_id: finalCategoryId === "" || finalCategoryId === "new" ? null : finalCategoryId,
        loom_video_id: loomVideoId,
        thumbnail_url: thumbnailUrl,
        ai_generated: aiGenerated,
        ai_raw_summary: aiRawSummary,
        status,
        created_by: user?.id
      });

      if (error) throw error;

      toast.success(`Video ${status === "published" ? "published" : "saved as draft"}!`);
      navigate(status === "published" ? `/videos/${videoId}` : "/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to save video");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Add Video</h1>

      <Card>
        <CardHeader>
          <CardTitle>1. Source</CardTitle>
          <CardDescription>Enter the Loom URL and let AI draft the details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              placeholder="https://www.loom.com/share/..."
              value={loomUrl}
              onChange={(e) => setLoomUrl(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !loomUrl}
              variant="secondary"
            >
              {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Analyze with AI
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Details</CardTitle>
          <CardDescription>Review and edit the video details before saving.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Video Title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this video about?"
              className="min-h-[120px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={isCreatingCategory ? "new" : categoryId}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "new") {
                  setIsCreatingCategory(true);
                  setCategoryId("new");
                } else {
                  setIsCreatingCategory(false);
                  setCategoryId(val);
                }
              }}
            >
              <option value="">Select a category...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="new">+ Create new category</option>
            </select>
          </div>

          {isCreatingCategory && (
            <div className="space-y-2 pl-4 border-l-2 border-primary/20">
              <Label htmlFor="newCategory">New Category Name</Label>
              <Input
                id="newCategory"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Sales Pipelines"
              />
            </div>
          )}

        </CardContent>
        <CardFooter className="flex justify-end gap-3 border-t p-6">
          <Button
            variant="outline"
            onClick={() => handleSave("draft")}
            disabled={isSaving}
          >
            Save as Draft
          </Button>
          <Button
            onClick={() => handleSave("published")}
            disabled={isSaving}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Publish Video
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
