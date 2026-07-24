import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, ANALYZE_LOOM_WEBHOOK_URL } from "../lib/supabaseClient";
import { useOrganization } from "../hooks/useOrganization";
import { useCategories } from "../hooks/useCategories";
import { useAuth } from "../hooks/useAuth";
import type { AnalyzeLoomResponse } from "../lib/types";

export function AddEditVideoPage() {
  const { orgId } = useOrganization();
  const { categories } = useCategories(orgId);
  const { session } = useAuth();
  const navigate = useNavigate();

  const [loomUrl, setLoomUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [aiGenerated, setAiGenerated] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!loomUrl.trim() || !orgId) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(ANALYZE_LOOM_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          loom_url: loomUrl,
          category_names: categories.map((c) => c.name),
        }),
      });
      if (!res.ok) {
        throw new Error(`n8n webhook returned ${res.status}`);
      }
      const data: AnalyzeLoomResponse = await res.json();
      setTitle(data.title);
      setDescription(data.description);
      setAiGenerated(true);
      // n8n returns the category by name (it only has what the frontend
      // sent it, not slugs from the database), so match on name here.
      const match = categories.find(
        (c) => c.name === data.suggested_category,
      );
      if (match) setCategoryId(match.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? `AI analysis failed: ${err.message}. You can still fill this in by hand.`
          : "AI analysis failed. You can still fill this in by hand.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async (status: "draft" | "published") => {
    if (!orgId || !title.trim() || !loomUrl.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("videos").insert({
      org_id: orgId,
      category_id: categoryId || null,
      title: title.trim(),
      description: description.trim() || null,
      loom_url: loomUrl.trim(),
      ai_generated: aiGenerated,
      status,
      created_by: session?.user.id ?? null,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    navigate("/");
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-6 py-8">
      <h1 className="text-2xl font-bold">Add a video</h1>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Loom link</span>
        <div className="flex gap-2">
          <input
            type="url"
            value={loomUrl}
            onChange={(e) => {
              setLoomUrl(e.target.value);
              setAiGenerated(false);
            }}
            placeholder="https://www.loom.com/share/…"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
          />
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!loomUrl.trim() || analyzing}
            className="rounded-md border border-brand px-3 py-2 text-sm text-brand disabled:opacity-50"
          >
            {analyzing ? "Analyzing…" : "Analyze with AI"}
          </button>
        </div>
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setAiGenerated(false);
          }}
          className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Description</span>
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setAiGenerated(false);
          }}
          rows={4}
          className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Category</span>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {aiGenerated && (
        <p className="text-xs text-gray-400">
          Title and description were AI-drafted from the Loom link — review
          before publishing.
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => handleSave("draft")}
          disabled={saving || !title.trim() || !loomUrl.trim()}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-gray-700"
        >
          Save as draft
        </button>
        <button
          type="button"
          onClick={() => handleSave("published")}
          disabled={saving || !title.trim() || !loomUrl.trim()}
          className="rounded-md bg-brand px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Publish
        </button>
      </div>
    </div>
  );
}
