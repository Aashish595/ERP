import { defineModel } from "../core/model.js";

export interface SchoolRecord extends Record<string, unknown> {
  id: number;
  name?: unknown;
  slug?: unknown;
  school_code?: unknown;
  institution_type?: unknown;
  email?: unknown;
  phone?: unknown;
  address?: unknown;
  city?: unknown;
  state?: unknown;
  country?: unknown;
  logo_url?: unknown;
  is_active?: unknown;
}

export const SchoolModel = defineModel<SchoolRecord>({
  name: "School", table: "schools", primaryKey: "id",
  fields: ["name","slug","school_code","institution_type","email","phone","address","city","state","country","logo_url","is_active"],
  requiredFields: ["name","slug","school_code"],
  schoolScoped: false, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});
