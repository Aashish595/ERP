import { defineModel } from "../core/model.js";

export interface VideoWatchProgressRecord extends Record<string, unknown> {
  id: number;
  student_id?: unknown;
  lesson_id?: unknown;
  watched_seconds?: unknown;
  video_duration_seconds?: unknown;
  max_position_seconds?: unknown;
  last_position_seconds?: unknown;
  last_watch_ping_at?: unknown;
}

export const VideoWatchProgressModel = defineModel<VideoWatchProgressRecord>({
  name: "VideoWatchProgress", table: "video_watch_progress", primaryKey: "id",
  fields: ["student_id","lesson_id","watched_seconds","video_duration_seconds","max_position_seconds","last_position_seconds","last_watch_ping_at"],
  requiredFields: ["student_id","lesson_id"],
  schoolScoped: false, hasCreatedAt: true, hasUpdatedAt: true,
});

