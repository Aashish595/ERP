import { Router } from "express";
import { allowRoles, requireAuth } from "../../auth.js";
import { createCrudRouter } from "../../core/crud.routes.js";
import {
  departmentController, schoolClassController, sectionController, subjectController,
} from "../../controllers/domain/academic.controller.js";

const managers = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN");
const read = [requireAuth];
const write = [requireAuth, managers];
export const academicRoutes = Router();
academicRoutes.use("/departments", createCrudRouter(departmentController, read, write));
academicRoutes.use("/classes", createCrudRouter(schoolClassController, read, write));
academicRoutes.use("/sections", createCrudRouter(sectionController, read, write));
academicRoutes.use("/subjects", createCrudRouter(subjectController, read, write));
