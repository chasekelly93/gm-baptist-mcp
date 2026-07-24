import { Link } from "react-router-dom";
import type { VideoWithCategory } from "../lib/types";

export function VideoCard({ video }: { video: VideoWithCategory }) {
  return (
    <Link
      to={`/videos/${video.id}`}
      className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4 hover:border-indigo-600 hover:shadow-sm dark:border-gray-700"
    >
      {video.thumbnail_url && (
        <img
          src={video.thumbnail_url}
          alt=""
          className="aspect-video w-full rounded-md object-cover"
        />
      )}
      <div className="flex items-center gap-2">
        {video.video_categories && (
          <span className="rounded-full bg-indigo-600/10 px-2 py-0.5 text-xs font-medium text-indigo-600">
            {video.video_categories.name}
          </span>
        )}
        {video.ai_generated && (
          <span className="text-xs text-gray-400">AI-drafted</span>
        )}
      </div>
      <h3 className="font-semibold">{video.title}</h3>
      {video.description && (
        <p className="line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
          {video.description}
        </p>
      )}
    </Link>
  );
}
