import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { ApiError } from "../errors.js";
import type { AuthUser } from "../types.js";

export class AuthenticationService {
  async validateCredentials(schoolCode: string, login: string, password: string): Promise<AuthUser> {
    const result = await query<AuthUser & import("pg").QueryResultRow & { hashed_password: string }>(
      `SELECT u.id,u.school_id,u.full_name,u.email,u.login_id,u.role,u.is_active,u.must_change_password,u.hashed_password
       FROM users u JOIN schools s ON s.id=u.school_id
       WHERE s.school_code=upper($1) AND s.is_active=true AND (u.login_id=lower($2) OR lower(u.email)=lower($2)) LIMIT 1`,
      [schoolCode, login],
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.hashed_password))) throw new ApiError(401, "Invalid school code, login ID, or password");
    if (!user.is_active) throw new ApiError(403, "Account is inactive");
    const { hashed_password: _password, ...publicUser } = user;
    return publicUser;
  }
}

export const authenticationService = new AuthenticationService();
