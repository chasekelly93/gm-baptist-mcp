export type VideoStatus = "draft" | "published" | "archived";

export interface Organization {
  id: string;
  slug: string;
  name: string;
  created_at: string;
}

export interface VideoCategory {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface Video {
  id: string;
  org_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  loom_url: string;
  loom_video_id: string | null;
  thumbnail_url: string | null;
  ai_generated: boolean;
  ai_raw_summary: string | null;
  status: VideoStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoWithCategory extends Video {
  video_categories: Pick<VideoCategory, "id" | "name" | "slug"> | null;
}

export interface VideoClickEvent {
  id: string;
  org_id: string;
  video_id: string;
  user_identifier: string;
  source: "copy_button" | "view";
  minute_bucket: string;
  created_at: string;
}

export interface VideoSearchEvent {
  id: string;
  org_id: string;
  query: string;
  result_count: number;
  clicked_video_id: string | null;
  searched_by: string | null;
  created_at: string;
}

export interface AnalyzeLoomResponse {
  title: string;
  description: string;
  suggested_category: string | null;
  loom_video_id: string | null;
  thumbnail_url: string | null;
  raw_summary: string;
}
