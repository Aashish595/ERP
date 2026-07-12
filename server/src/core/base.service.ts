import type { Request } from "express";
import type { Page, SqlRepository } from "./base.repository.js";

export class CrudService<TRecord extends Record<string, unknown>> {
  constructor(protected readonly repository: SqlRepository<TRecord>) {}
  list(req: Request): Promise<TRecord[]> { return this.repository.list(req); }
  page(req: Request): Promise<Page<TRecord>> { return this.repository.page(req); }
  get(id: string | number, req: Request): Promise<TRecord> { return this.repository.requireById(id, req); }
  create(payload: Record<string, unknown>, req: Request): Promise<TRecord> { return this.repository.create(payload, req); }
  update(id: string | number, payload: Record<string, unknown>, req: Request): Promise<TRecord> { return this.repository.update(id, payload, req); }
  remove(id: string | number, req: Request): Promise<void> { return this.repository.remove(id, req); }
}
