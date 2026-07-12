import { defineModel } from "../core/model.js";

export interface MeetingRecord extends Record<string, unknown> {
  id: number;
  bbb_meeting_id?: unknown;
  attendee_password?: unknown;
  moderator_password?: unknown;
  title?: unknown;
  meeting_type?: unknown;
  status?: unknown;
  created_by_user_id?: unknown;
  class_id?: unknown;
  section_id?: unknown;
  section_name?: unknown;
  teacher_id?: unknown;
  record?: unknown;
  recording_url?: unknown;
  scheduled_at?: unknown;
  started_at?: unknown;
  ended_at?: unknown;
}

export const MeetingModel = defineModel<MeetingRecord>({
  name: "Meeting", table: "meetings", primaryKey: "id",
  fields: ["bbb_meeting_id","attendee_password","moderator_password","title","meeting_type","status","created_by_user_id","class_id","section_id","section_name","teacher_id","record","recording_url","scheduled_at","started_at","ended_at"],
  requiredFields: ["title","meeting_type"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: false,
});

