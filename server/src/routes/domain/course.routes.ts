import { allowRoles, requireAuth } from "../../auth.js";
import { createCrudRouter } from "../../core/crud.routes.js";
import { courseController } from "../../controllers/domain/course.controller.js";

const managers = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN");
export const courseRoutes = createCrudRouter(courseController, [requireAuth], [requireAuth, managers]);
