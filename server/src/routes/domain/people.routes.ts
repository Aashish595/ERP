import { allowRoles, requireAuth } from "../../auth.js";
import { createCrudRouter } from "../../core/crud.routes.js";
import { peopleController } from "../../controllers/domain/people.controller.js";

const managers = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN");
export const peopleRoutes = createCrudRouter(peopleController, [requireAuth], [requireAuth, managers]);
