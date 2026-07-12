import { defineModel } from "../core/model.js";

export interface NoticeRecord extends Record<string, unknown> {
  id: number;
  created_by?: unknown;
  title?: unknown;
  content?: unknown;
  priority?: unknown;
  status?: unknown;
  is_pinned?: unknown;
  pinned_by?: unknown;
  publish_at?: unknown;
  expires_at?: unknown;
}

export const NoticeModel = defineModel<NoticeRecord>({
  name: "Notice", table: "notices", primaryKey: "id",
  fields: ["created_by","title","content","priority","status","is_pinned","pinned_by","publish_at","expires_at"],
  requiredFields: ["created_by","title","content"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
});

export interface NoticeAudienceRecord extends Record<string, unknown> {
  id: number;
  notice_id?: unknown;
  role?: unknown;
}

export const NoticeAudienceModel = defineModel<NoticeAudienceRecord>({
  name: "NoticeAudience", table: "notice_audiences", primaryKey: "id",
  fields: ["notice_id","role"],
  requiredFields: ["notice_id","role"],
  schoolScoped: false, hasCreatedAt: true, hasUpdatedAt: false,
});

export interface NoticeReadRecord extends Record<string, unknown> {
  id: number;
  notice_id?: unknown;
  user_id?: unknown;
  read_at?: unknown;
}

export const NoticeReadModel = defineModel<NoticeReadRecord>({
  name: "NoticeRead", table: "notice_reads", primaryKey: "id",
  fields: ["notice_id","user_id","read_at"],
  requiredFields: ["notice_id","user_id"],
  schoolScoped: false, hasCreatedAt: true, hasUpdatedAt: false,
});

export interface NoticeClassAudienceRecord extends Record<string, unknown> {
  id: number;
  notice_id?: unknown;
  class_id?: unknown;
  section_id?: unknown;
  section_name?: unknown;
}

export const NoticeClassAudienceModel = defineModel<NoticeClassAudienceRecord>({
  name: "NoticeClassAudience", table: "notice_class_audiences", primaryKey: "id",
  fields: ["notice_id","class_id","section_id","section_name"],
  requiredFields: ["notice_id","class_id"],
  schoolScoped: false, hasCreatedAt: true, hasUpdatedAt: false,
});

