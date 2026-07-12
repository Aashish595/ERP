import type { Request } from "express";

export type UserRole = "SUPER_ADMIN" | "SCHOOL_OWNER" | "SCHOOL_ADMIN" | "TEACHER" | "STUDENT" | "PARENT";

export interface AuthUser {
  id: number;
  school_id: number | null;
  full_name: string;
  email: string;
  login_id: string;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
}

export type AuthenticatedRequest = Request<any, any, any, any> & {
  user: AuthUser;
  academicSessionId?: number;
  requestStartedAt?: bigint;
};

export interface JwtPayload {
  sub: string;
  role: UserRole;
  school_id: number | null;
  type: "access";
}
