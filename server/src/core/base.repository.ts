import type { Request } from "express";
import { query, sqlIdentifier } from "../db.js";
import { ApiError } from "../errors.js";
import { schoolId } from "../auth.js";
import type { ModelDefinition } from "./model.js";

export interface Page<T> { items: T[]; total: number; limit: number; offset: number }

export class SqlRepository<TRecord extends Record<string, unknown>> {
  constructor(public readonly model: ModelDefinition<TRecord>) {}

  private scope(req: Request, values: unknown[]) {
    if (!this.model.schoolScoped) return "";
    values.push(schoolId(req));
    return `school_id=$${values.length}`;
  }

  private writable(payload: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(payload).filter(([field, value]) => this.model.fields.includes(field as keyof TRecord & string) && value !== undefined),
    );
  }

  async page(req: Request): Promise<Page<TRecord>> {
    const values: unknown[] = [];
    const conditions: string[] = [];
    const scoped = this.scope(req, values);
    if (scoped) conditions.push(scoped);
    for (const field of this.model.fields) {
      const value = req.query[field];
      if (typeof value !== "string" || value === "") continue;
      values.push(value);
      conditions.push(`${sqlIdentifier(field)}=$${values.length}`);
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const count = await query<{ total: number }>(`SELECT COUNT(*)::int total FROM ${sqlIdentifier(this.model.table)} ${where}`, values);
    values.push(limit, offset);
    const result = await query<TRecord & import("pg").QueryResultRow>(
      `SELECT * FROM ${sqlIdentifier(this.model.table)} ${where} ORDER BY ${sqlIdentifier(this.model.primaryKey)} DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return { items: result.rows, total: count.rows[0]?.total ?? 0, limit, offset };
  }

  async list(req: Request): Promise<TRecord[]> { return (await this.page(req)).items; }

  async findById(id: number | string, req: Request): Promise<TRecord | null> {
    const values: unknown[] = [id];
    const conditions = [`${sqlIdentifier(this.model.primaryKey)}=$1`];
    const scoped = this.scope(req, values);
    if (scoped) conditions.push(scoped);
    const result = await query<TRecord & import("pg").QueryResultRow>(
      `SELECT * FROM ${sqlIdentifier(this.model.table)} WHERE ${conditions.join(" AND ")} LIMIT 1`, values,
    );
    return result.rows[0] ?? null;
  }

  async requireById(id: number | string, req: Request): Promise<TRecord> {
    const row = await this.findById(id, req);
    if (!row) throw new ApiError(404, `${this.model.name} not found`);
    return row;
  }

  async create(payload: Record<string, unknown>, req: Request): Promise<TRecord> {
    const data = this.writable(payload);
    if (this.model.schoolScoped) data.school_id = schoolId(req);
    for (const field of this.model.requiredFields) {
      if (data[field] === undefined || data[field] === null || data[field] === "") throw new ApiError(422, `${field} is required`);
    }
    const columns = Object.keys(data);
    const result = await query<TRecord & import("pg").QueryResultRow>(
      `INSERT INTO ${sqlIdentifier(this.model.table)}(${columns.map(sqlIdentifier).join(",")}) VALUES(${columns.map((_, index) => `$${index + 1}`).join(",")}) RETURNING *`,
      Object.values(data),
    );
    return result.rows[0]!;
  }

  async update(id: number | string, payload: Record<string, unknown>, req: Request): Promise<TRecord> {
    const data = this.writable(payload);
    const columns = Object.keys(data);
    if (!columns.length) return this.requireById(id, req);
    const values = Object.values(data);
    values.push(id);
    const conditions = [`${sqlIdentifier(this.model.primaryKey)}=$${values.length}`];
    const scoped = this.scope(req, values);
    if (scoped) conditions.push(scoped);
    const timestamp = this.model.hasUpdatedAt ? ",updated_at=NOW()" : "";
    const result = await query<TRecord & import("pg").QueryResultRow>(
      `UPDATE ${sqlIdentifier(this.model.table)} SET ${columns.map((field, index) => `${sqlIdentifier(field)}=$${index + 1}`).join(",")}${timestamp} WHERE ${conditions.join(" AND ")} RETURNING *`,
      values,
    );
    if (!result.rows[0]) throw new ApiError(404, `${this.model.name} not found`);
    return result.rows[0];
  }

  async remove(id: number | string, req: Request): Promise<void> {
    const values: unknown[] = [id];
    const conditions = [`${sqlIdentifier(this.model.primaryKey)}=$1`];
    const scoped = this.scope(req, values);
    if (scoped) conditions.push(scoped);
    const statement = this.model.softDeleteField
      ? `UPDATE ${sqlIdentifier(this.model.table)} SET ${sqlIdentifier(this.model.softDeleteField)}=false${this.model.hasUpdatedAt ? ",updated_at=NOW()" : ""}`
      : `DELETE FROM ${sqlIdentifier(this.model.table)}`;
    const result = await query(`${statement} WHERE ${conditions.join(" AND ")} RETURNING ${sqlIdentifier(this.model.primaryKey)}`, values);
    if (!result.rowCount) throw new ApiError(404, `${this.model.name} not found`);
  }
}
