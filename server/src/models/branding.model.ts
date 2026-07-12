import { defineModel } from "../core/model.js";

export interface SchoolBrandingRecord extends Record<string, unknown> {
  id: number;
  school_id?: unknown;
  logo_url?: unknown;
  favicon_url?: unknown;
  primary_color?: unknown;
  secondary_color?: unknown;
  accent_color?: unknown;
  sidebar_color?: unknown;
  background_color?: unknown;
  text_color?: unknown;
  theme_mode?: unknown;
  theme_source?: unknown;
  preset_name?: unknown;
  border_radius?: unknown;
}

export const SchoolBrandingModel = defineModel<SchoolBrandingRecord>({
  name: "SchoolBranding", table: "school_branding", primaryKey: "id",
  fields: ["school_id","logo_url","favicon_url","primary_color","secondary_color","accent_color","sidebar_color","background_color","text_color","theme_mode","theme_source","preset_name","border_radius"],
  requiredFields: ["school_id"],
  schoolScoped: false, hasCreatedAt: true, hasUpdatedAt: true,
});

