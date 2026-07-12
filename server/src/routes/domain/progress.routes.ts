import { allowRoles, requireAuth } from "../../auth.js";
import { createCrudRouter } from "../../core/crud.routes.js";
import { progressController } from "../../controllers/domain/progress.controller.js";

const managers = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN");
export const progressRoutes = createCrudRouter(progressController, [requireAuth], [requireAuth, managers]);
