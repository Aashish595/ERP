import { allowRoles, requireAuth } from "../../auth.js";
import { createCrudRouter } from "../../core/crud.routes.js";
import { homeworkController } from "../../controllers/domain/homework.controller.js";

const managers = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN");
export const homeworkRoutes = createCrudRouter(homeworkController, [requireAuth], [requireAuth, managers]);
