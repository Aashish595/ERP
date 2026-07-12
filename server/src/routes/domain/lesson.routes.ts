import { allowRoles, requireAuth } from "../../auth.js";
import { createCrudRouter } from "../../core/crud.routes.js";
import { lessonController } from "../../controllers/domain/lesson.controller.js";

const managers = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN");
export const lessonRoutes = createCrudRouter(lessonController, [requireAuth], [requireAuth, managers]);
