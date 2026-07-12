import { allowRoles, requireAuth } from "../../auth.js";
import { createCrudRouter } from "../../core/crud.routes.js";
import { examController } from "../../controllers/domain/exam.controller.js";

const managers = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN");
export const examRoutes = createCrudRouter(examController, [requireAuth], [requireAuth, managers]);
