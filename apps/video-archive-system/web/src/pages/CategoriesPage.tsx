import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useOrganization } from "../hooks/useOrganization";
import { useCategories } from "../hooks/useCategories";

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function CategoriesPage() {
  const { orgId } = useOrganization();
  const { categories, refresh } = useCategories(orgId);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!orgId || !name.trim()) return;
    const { error: insertError } = await supabase
      .from("video_categories")
      .insert({ org_id: orgId, name: name.trim(), slug: slugify(name) });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setName("");
    setError(null);
    refresh();
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-6 py-8">
      <h1 className="text-2xl font-bold">Categories</h1>

      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!name.trim()}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}

      <ul className="flex flex-col gap-1">
        {categories.map((c) => (
          <li
            key={c.id}
            className="rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
          >
            {c.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
