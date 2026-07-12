import { allowRoles, requireAuth } from "../../auth.js";
import { createCrudRouter } from "../../core/crud.routes.js";
import { profileController } from "../../controllers/domain/profile.controller.js";

const managers = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN");
export const profileRoutes = createCrudRouter(profileController, [requireAuth], [requireAuth, managers]);
