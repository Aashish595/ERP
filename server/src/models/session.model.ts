import { defineModel } from "../core/model.js";

export interface RefreshTokenRecord extends Record<string, unknown> {
  id: number;
  user_id?: unknown;
  token_hash?: unknown;
  expires_at?: unknown;
  revoked_at?: unknown;
  last_used_at?: unknown;
  replaced_by_token_id?: unknown;
  user_agent?: unknown;
  ip_address?: unknown;
}

export const RefreshTokenModel = defineModel<RefreshTokenRecord>({
  name: "RefreshToken", table: "refresh_tokens", primaryKey: "id",
  fields: ["user_id","token_hash","expires_at","revoked_at","last_used_at","replaced_by_token_id","user_agent","ip_address"],
  requiredFields: ["user_id","token_hash","expires_at"],
  schoolScoped: false, hasCreatedAt: true, hasUpdatedAt: false,
});

