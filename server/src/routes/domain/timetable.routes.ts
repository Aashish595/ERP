import { allowRoles, requireAuth } from "../../auth.js";
import { createCrudRouter } from "../../core/crud.routes.js";
import { timetableController } from "../../controllers/domain/timetable.controller.js";

const managers = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN");
export const timetableRoutes = createCrudRouter(timetableController, [requireAuth], [requireAuth, managers]);
