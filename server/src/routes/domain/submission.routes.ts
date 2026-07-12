import { allowRoles, requireAuth } from "../../auth.js";
import { createCrudRouter } from "../../core/crud.routes.js";
import { submissionController } from "../../controllers/domain/submission.controller.js";

const managers = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN");
export const submissionRoutes = createCrudRouter(submissionController, [requireAuth], [requireAuth, managers]);
