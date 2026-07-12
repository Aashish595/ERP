import { defineModel } from "../core/model.js";

export interface UserRecord extends Record<string, unknown> {
  id: number;
  school_id?: unknown;
  full_name?: unknown;
  email?: unknown;
  phone?: unknown;
  login_id?: unknown;
  hashed_password?: unknown;
  role?: unknown;
  is_active?: unknown;
  must_change_password?: unknown;
  password_reset_token_hash?: unknown;
  password_reset_expires_at?: unknown;
  last_login_at?: unknown;
  failed_login_attempts?: unknown;
  locked_until?: unknown;
}

export const UserModel = defineModel<UserRecord>({
  name: "User", table: "users", primaryKey: "id",
  fields: ["school_id","full_name","email","phone","login_id","hashed_password","role","is_active","must_change_password","password_reset_token_hash","password_reset_expires_at","last_login_at","failed_login_attempts","locked_until"],
  requiredFields: ["full_name","email","login_id","hashed_password"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});

