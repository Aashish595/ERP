import type { Request } from "express";
import { query, sqlIdentifier } from "./db.js";
import { ApiError } from "./errors.js";
import { schoolId } from "./auth.js";

export interface ResourceDefinition {
  table: string;
  fields: readonly string[];
  schoolScoped?: boolean;
  sessionScoped?: boolean;
  orderBy?: string;
  softDelete?: boolean;
  hasUpdatedAt?: boolean;
}

function cleanPayload(payload: Record<string, unknown>, allowed: readonly string[]) {
  return Object.fromEntries(Object.entries(payload).filter(([key, value]) => allowed.includes(key) && value !== undefined));
}

export async function listResource(definition: ResourceDefinition, req: Request) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (definition.schoolScoped !== false) {
    values.push(schoolId(req));
    conditions.push(`school_id=$${values.length}`);
  }
  for (const field of definition.fields) {
    const raw = req.query[field];
    if (typeof raw !== "string" || raw === "") continue;
    values.push(raw);
    conditions.push(`${sqlIdentifier(field)}=$${values.length}`);
  }
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const searchable = definition.fields.filter((field) => ["name", "title", "full_name", "admission_no", "employee_id", "isbn"].includes(field));
  if (search && searchable.length) {
    values.push(`%${search}%`);
    conditions.push(`(${searchable.map((field) => `${sqlIdentifier(field)} ILIKE $${values.length}`).join(" OR ")})`);
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 1000);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  values.push(limit, offset);
  const result = await query(
    `SELECT * FROM ${sqlIdentifier(definition.table)} ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
     ORDER BY ${sqlIdentifier(definition.orderBy ?? "id")} DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return result.rows;
}

export async function getResource(definition: ResourceDefinition, id: number, req: Request) {
  const values: unknown[] = [id];
  let where = "id=$1";
  if (definition.schoolScoped !== false) {
    values.push(schoolId(req));
    where += ` AND school_id=$${values.length}`;
  }
  const result = await query(`SELECT * FROM ${sqlIdentifier(definition.table)} WHERE ${where} LIMIT 1`, values);
  if (!result.rows[0]) throw new ApiError(404, "Record not found");
  return result.rows[0];
}

export async function createResource(definition: ResourceDefinition, body: Record<string, unknown>, req: Request) {
  const data = cleanPayload(body, definition.fields);
  if (definition.schoolScoped !== false) data.school_id = schoolId(req);
  const columns = Object.keys(data);
  if (!columns.length) throw new ApiError(422, "No valid fields supplied");
  const values = Object.values(data);
  const result = await query(
    `INSERT INTO ${sqlIdentifier(definition.table)} (${columns.map(sqlIdentifier).join(",")})
     VALUES (${values.map((_, index) => `$${index + 1}`).join(",")}) RETURNING *`,
    values,
  );
  return result.rows[0];
}

export async function updateResource(definition: ResourceDefinition, id: number, body: Record<string, unknown>, req: Request) {
  const data = cleanPayload(body, definition.fields);
  const columns = Object.keys(data);
  if (!columns.length) return getResource(definition, id, req);
  const values = Object.values(data);
  values.push(id);
  let where = `id=$${values.length}`;
  if (definition.schoolScoped !== false) {
    values.push(schoolId(req));
    where += ` AND school_id=$${values.length}`;
  }
  const result = await query(
    `UPDATE ${sqlIdentifier(definition.table)} SET ${columns.map((column, index) => `${sqlIdentifier(column)}=$${index + 1}`).join(",")}${definition.hasUpdatedAt === false ? "" : ", updated_at=NOW()"}
     WHERE ${where} RETURNING *`,
    values,
  );
  if (!result.rows[0]) throw new ApiError(404, "Record not found");
  return result.rows[0];
}

export async function deleteResource(definition: ResourceDefinition, id: number, req: Request) {
  const values: unknown[] = [id];
  let where = "id=$1";
  if (definition.schoolScoped !== false) {
    values.push(schoolId(req));
    where += ` AND school_id=$${values.length}`;
  }
  const sql = definition.softDelete
    ? `UPDATE ${sqlIdentifier(definition.table)} SET is_active=false${definition.hasUpdatedAt === false ? "" : ", updated_at=NOW()"} WHERE ${where} RETURNING id`
    : `DELETE FROM ${sqlIdentifier(definition.table)} WHERE ${where} RETURNING id`;
  const result = await query(sql, values);
  if (!result.rows[0]) throw new ApiError(404, "Record not found");
  return { message: "Deleted successfully" };
}
