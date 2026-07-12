import { allowRoles, requireAuth } from "../../auth.js";
import { createCrudRouter } from "../../core/crud.routes.js";
import { meetingController } from "../../controllers/domain/meeting.controller.js";

const managers = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN");
export const meetingRoutes = createCrudRouter(meetingController, [requireAuth], [requireAuth, managers]);
