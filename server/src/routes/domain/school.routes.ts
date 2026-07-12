import { allowRoles, requireAuth } from "../../auth.js";
import { createCrudRouter } from "../../core/crud.routes.js";
import { schoolController } from "../../controllers/domain/school.controller.js";

const managers = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN");
export const schoolRoutes = createCrudRouter(schoolController, [requireAuth], [requireAuth, managers]);
