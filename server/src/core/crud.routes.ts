import { Router, type RequestHandler } from "express";
import type { CrudController } from "./base.controller.js";

export function createCrudRouter<TRecord extends Record<string, unknown>>(
  controller: CrudController<TRecord>,
  readMiddleware: RequestHandler[],
  writeMiddleware: RequestHandler[],
) {
  const router = Router();
  router.get("/", ...readMiddleware, controller.list);
  router.get("/:id", ...readMiddleware, controller.get);
  router.post("/", ...writeMiddleware, controller.create);
  router.put("/:id", ...writeMiddleware, controller.update);
  router.patch("/:id", ...writeMiddleware, controller.update);
  router.delete("/:id", ...writeMiddleware, controller.remove);
  return router;
}
