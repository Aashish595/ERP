import { defineModel } from "../core/model.js";

export interface AnnouncementRecord extends Record<string, unknown> {
  id: number;
  created_by?: unknown;
  title?: unknown;
  message?: unknown;
  priority?: unknown;
  status?: unknown;
  audience_roles?: unknown;
  start_at?: unknown;
  end_at?: unknown;
}

export const AnnouncementModel = defineModel<AnnouncementRecord>({
  name: "Announcement", table: "communication_announcements", primaryKey: "id",
  fields: ["created_by","title","message","priority","status","audience_roles","start_at","end_at"],
  requiredFields: ["title","message"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
});

export interface SchoolEventRecord extends Record<string, unknown> {
  id: number;
  created_by?: unknown;
  title?: unknown;
  description?: unknown;
  event_date?: unknown;
  end_date?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  location?: unknown;
  category?: unknown;
  status?: unknown;
  audience_roles?: unknown;
}

export const SchoolEventModel = defineModel<SchoolEventRecord>({
  name: "SchoolEvent", table: "communication_events", primaryKey: "id",
  fields: ["created_by","title","description","event_date","end_date","start_time","end_time","location","category","status","audience_roles"],
  requiredFields: ["title","event_date"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
});

export interface ComplaintRecord extends Record<string, unknown> {
  id: number;
  created_by?: unknown;
  assigned_to?: unknown;
  subject?: unknown;
  description?: unknown;
  category?: unknown;
  priority?: unknown;
  status?: unknown;
  action_taken?: unknown;
  is_anonymous?: unknown;
  resolved_at?: unknown;
}

export const ComplaintModel = defineModel<ComplaintRecord>({
  name: "Complaint", table: "complaints", primaryKey: "id",
  fields: ["created_by","assigned_to","subject","description","category","priority","status","action_taken","is_anonymous","resolved_at"],
  requiredFields: ["subject","description"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
});

export interface InAppNotificationRecord extends Record<string, unknown> {
  id: number;
  created_by?: unknown;
  target_role?: unknown;
  target_user_id?: unknown;
  title?: unknown;
  message?: unknown;
  category?: unknown;
  priority?: unknown;
  link?: unknown;
  expires_at?: unknown;
}

export const InAppNotificationModel = defineModel<InAppNotificationRecord>({
  name: "InAppNotification", table: "in_app_notifications", primaryKey: "id",
  fields: ["created_by","target_role","target_user_id","title","message","category","priority","link","expires_at"],
  requiredFields: ["title","message"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: false,
});

export interface InAppNotificationReadRecord extends Record<string, unknown> {
  id: number;
  notification_id?: unknown;
  user_id?: unknown;
  read_at?: unknown;
}

export const InAppNotificationReadModel = defineModel<InAppNotificationReadRecord>({
  name: "InAppNotificationRead", table: "in_app_notification_reads", primaryKey: "id",
  fields: ["notification_id","user_id","read_at"],
  requiredFields: ["notification_id","user_id"],
  schoolScoped: false, hasCreatedAt: true, hasUpdatedAt: false,
});

