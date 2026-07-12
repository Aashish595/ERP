import { allowRoles, requireAuth } from "../../auth.js";
import { createCrudRouter } from "../../core/crud.routes.js";
import { attendanceController } from "../../controllers/domain/attendance.controller.js";

const managers = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN");
export const attendanceRoutes = createCrudRouter(attendanceController, [requireAuth], [requireAuth, managers]);
