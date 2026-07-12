import { defineModel } from "../core/model.js";

export interface ChatSessionRecord extends Record<string, unknown> {
  id: number | string;
  title?: unknown;
  user_id?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}

export const ChatSessionModel = defineModel<ChatSessionRecord>({
  name: "ChatSession", table: "chat_session", primaryKey: "id",
  fields: ["title","user_id","created_at","updated_at"],
  requiredFields: ["user_id"],
  schoolScoped: false, hasCreatedAt: true, hasUpdatedAt: true,
});

export interface ChatMessageRecord extends Record<string, unknown> {
  id: number;
  role?: unknown;
  content?: unknown;
  session_id?: unknown;
  user_id?: unknown;
  tool_calls?: unknown;
  tool_call_id?: unknown;
  is_enhanced?: unknown;
}

export const ChatMessageModel = defineModel<ChatMessageRecord>({
  name: "ChatMessage", table: "chat_message", primaryKey: "id",
  fields: ["role","content","session_id","user_id","tool_calls","tool_call_id","is_enhanced"],
  requiredFields: ["role","session_id","user_id"],
  schoolScoped: false, hasCreatedAt: true, hasUpdatedAt: false,
});

