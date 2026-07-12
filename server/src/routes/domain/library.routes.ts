import { allowRoles, requireAuth } from "../../auth.js";
import { createCrudRouter } from "../../core/crud.routes.js";
import { libraryController } from "../../controllers/domain/library.controller.js";

const managers = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN");
export const libraryRoutes = createCrudRouter(libraryController, [requireAuth], [requireAuth, managers]);
