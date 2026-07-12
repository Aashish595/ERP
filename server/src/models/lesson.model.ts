import { defineModel } from "../core/model.js";

export interface LessonRecord extends Record<string, unknown> {
  id: number;
  title?: unknown;
  description?: unknown;
  order?: unknown;
  video_url?: unknown;
  pdf_url?: unknown;
  external_video_link?: unknown;
  transcript?: unknown;
  notes?: unknown;
  video_public_id?: unknown;
  pdf_public_id?: unknown;
  course_id?: unknown;
  language?: unknown;
  summary?: unknown;
}

export const LessonModel = defineModel<LessonRecord>({
  name: "Lesson", table: "lessons", primaryKey: "id",
  fields: ["title","description","order","video_url","pdf_url","external_video_link","transcript","notes","video_public_id","pdf_public_id","course_id","language","summary"],
  requiredFields: ["title","course_id"],
  schoolScoped: false, hasCreatedAt: true, hasUpdatedAt: false,
});

export interface LessonChunkRecord extends Record<string, unknown> {
  id: number;
  content?: unknown;
  source?: unknown;
  chunk_index?: unknown;
  embedding?: unknown;
  lesson_id?: unknown;
  start_time?: unknown;
  end_time?: unknown;
}

export const LessonChunkModel = defineModel<LessonChunkRecord>({
  name: "LessonChunk", table: "lesson_chunk", primaryKey: "id",
  fields: ["content","source","chunk_index","embedding","lesson_id","start_time","end_time"],
  requiredFields: ["content","source","lesson_id"],
  schoolScoped: false, hasCreatedAt: true, hasUpdatedAt: false,
});

