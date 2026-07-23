import type { VideoCategory } from "../lib/types";

export function CategoryChips({
  categories,
  activeId,
  onSelect,
}: {
  categories: VideoCategory[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`rounded-full px-3 py-1 text-sm ${
          activeId === null
            ? "bg-brand text-white"
            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
        }`}
      >
        All
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.id)}
          className={`rounded-full px-3 py-1 text-sm ${
            activeId === c.id
              ? "bg-brand text-white"
              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
