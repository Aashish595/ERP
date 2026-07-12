import { allowRoles, requireAuth } from "../../auth.js";
import { createCrudRouter } from "../../core/crud.routes.js";
import { communicationController } from "../../controllers/domain/communication.controller.js";

const managers = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN");
export const communicationRoutes = createCrudRouter(communicationController, [requireAuth], [requireAuth, managers]);
