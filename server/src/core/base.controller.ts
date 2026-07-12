import type { NextFunction, Request, Response } from "express";
import type { CrudService } from "./base.service.js";

export class CrudController<TRecord extends Record<string, unknown>> {
  constructor(private readonly service: CrudService<TRecord>) {}
  list = async (req: Request, res: Response, next: NextFunction) => { try { res.json(await this.service.list(req)); } catch (error) { next(error); } };
  get = async (req: Request, res: Response, next: NextFunction) => { try { res.json(await this.service.get(String(req.params.id), req)); } catch (error) { next(error); } };
  create = async (req: Request, res: Response, next: NextFunction) => { try { res.status(201).json(await this.service.create(req.body, req)); } catch (error) { next(error); } };
  update = async (req: Request, res: Response, next: NextFunction) => { try { res.json(await this.service.update(String(req.params.id), req.body, req)); } catch (error) { next(error); } };
  remove = async (req: Request, res: Response, next: NextFunction) => { try { await this.service.remove(String(req.params.id), req); res.json({ message: "Deleted successfully" }); } catch (error) { next(error); } };
}
