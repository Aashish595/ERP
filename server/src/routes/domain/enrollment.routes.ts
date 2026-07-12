import { allowRoles, requireAuth } from "../../auth.js";
import { createCrudRouter } from "../../core/crud.routes.js";
import { enrollmentController } from "../../controllers/domain/enrollment.controller.js";

const managers = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN");
export const enrollmentRoutes = createCrudRouter(enrollmentController, [requireAuth], [requireAuth, managers]);
