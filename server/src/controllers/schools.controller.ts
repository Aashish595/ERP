import { Router } from "express";
import { allowRoles, requireAuth, schoolId } from "../auth.js";
import { query } from "../db.js";
import { ApiError } from "../errors.js";
import { upload } from "../uploads.js";
import { uploadService } from "../services/upload.service.js";
import { getProfileView, updateProfileView } from "../services/profile-view.service.js";
import type { AuthenticatedRequest } from "../types.js";

export const schoolsRouter = Router();
const storeUpload = uploadService.store.bind(uploadService);

const brandingDefaults = {
  logo_url: null, favicon_url: null, primary_color: "#2563eb", secondary_color: "#0f172a",
  accent_color: "#22c55e", sidebar_color: "#0f172a", background_color: "#f8fafc",
  text_color: "#0f172a", theme_mode: "light", theme_source: "preset",
  preset_name: "professional_blue", border_radius: 16,
};

schoolsRouter.get("/branding/by-code/:schoolCode", async (req, res) => {
  const result = await query<any>(
    `SELECT s.name AS school_name,s.school_code,b.* FROM schools s LEFT JOIN school_branding b ON b.school_id=s.id
     WHERE s.school_code=upper($1) AND s.is_active=true LIMIT 1`, [req.params.schoolCode],
  );
  const row = result.rows[0];
  if (!row) throw new ApiError(404, "School not found");
  res.json({ ...brandingDefaults, ...row });
});

schoolsRouter.use(requireAuth);
schoolsRouter.get("/me", async (req, res) => {
  const row = (await query("SELECT * FROM schools WHERE id=$1", [schoolId(req)])).rows[0];
  if (!row) throw new ApiError(404, "School not found");
  res.json(row);
});
schoolsRouter.put("/me", allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN"), async (req, res) => {
  const allowed = ["name", "institution_type", "email", "phone", "address", "city", "state", "country", "logo_url"];
  const entries = Object.entries(req.body).filter(([key, value]) => allowed.includes(key) && value !== undefined);
  if (!entries.length) throw new ApiError(422, "No valid fields supplied");
  const result = await query(
    `UPDATE schools SET ${entries.map(([key], i) => `"${key}"=$${i + 1}`).join(",")},updated_at=NOW() WHERE id=$${entries.length + 1} RETURNING *`,
    [...entries.map(([, value]) => value), schoolId(req)],
  );
  res.json(result.rows[0]);
});
schoolsRouter.get("/branding/me", async (req, res) => {
  const sid = schoolId(req);
  const result = await query<any>("SELECT * FROM school_branding WHERE school_id=$1", [sid]);
  if (result.rows[0]) return res.json(result.rows[0]);
  const created = await query<any>(
    `INSERT INTO school_branding(school_id,primary_color,secondary_color,accent_color,sidebar_color,background_color,text_color,theme_mode,theme_source,preset_name,border_radius)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [sid, brandingDefaults.primary_color, brandingDefaults.secondary_color, brandingDefaults.accent_color, brandingDefaults.sidebar_color, brandingDefaults.background_color, brandingDefaults.text_color, brandingDefaults.theme_mode, brandingDefaults.theme_source, brandingDefaults.preset_name, brandingDefaults.border_radius],
  );
  res.json(created.rows[0]);
});
schoolsRouter.put("/branding/me", allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN"), async (req, res) => {
  const allowed = ["logo_url", "favicon_url", "primary_color", "secondary_color", "accent_color", "sidebar_color", "background_color", "text_color", "theme_mode", "theme_source", "preset_name", "border_radius"];
  const data = Object.fromEntries(Object.entries(req.body).filter(([key, value]) => allowed.includes(key) && value !== undefined));
  const columns = Object.keys(data);
  const values = Object.values(data);
  const result = await query(
    `INSERT INTO school_branding(school_id,${columns.join(",")}) VALUES($1,${columns.map((_, i) => `$${i + 2}`).join(",")})
     ON CONFLICT(school_id) DO UPDATE SET ${columns.map((column, i) => `${column}=$${i + 2}`).join(",")},updated_at=NOW() RETURNING *`,
    [schoolId(req), ...values],
  );
  res.json(result.rows[0]);
});
schoolsRouter.post("/branding/logo", allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN"), upload.single("file"), async (req, res) => {
  if (!req.file) throw new ApiError(422, "Logo file is required");
  const url = await storeUpload(req.file, `schools/${schoolId(req)}/branding`);
  const result = await query<any>(
    `INSERT INTO school_branding(school_id,logo_url) VALUES($1,$2)
     ON CONFLICT(school_id) DO UPDATE SET logo_url=$2,updated_at=NOW() RETURNING *`, [schoolId(req), url],
  );
  await query("UPDATE schools SET logo_url=$1 WHERE id=$2", [url, schoolId(req)]);
  res.status(201).json({ logo_url: url, branding: result.rows[0] });
});

export const profileRouter = Router();
profileRouter.use(requireAuth);
profileRouter.get("/", async (req, res) => {
  res.json(await getProfileView(req as AuthenticatedRequest));
});
profileRouter.put("/", async (req, res) => {
  res.json(await updateProfileView(req as AuthenticatedRequest, req.body));
});
profileRouter.post("/teacher/photo", upload.single("file"), async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  if (user.role !== "TEACHER") throw new ApiError(403, "Only teachers can upload a teacher profile photo");
  if (!req.file) throw new ApiError(422, "Photo is required");
  const photo = await storeUpload(req.file, `schools/${user.school_id}/teachers`);
  const updated = await query("UPDATE teachers SET photo_url=$1,updated_at=NOW() WHERE user_id=$2 AND school_id=$3 RETURNING id", [photo, user.id, user.school_id]);
  if (!updated.rowCount) throw new ApiError(404, "Teacher profile is not linked to this login yet");
  res.json(await getProfileView(req as AuthenticatedRequest));
});
