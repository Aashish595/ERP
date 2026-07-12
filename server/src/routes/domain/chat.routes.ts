import { allowRoles, requireAuth } from "../../auth.js";
import { createCrudRouter } from "../../core/crud.routes.js";
import { chatController } from "../../controllers/domain/chat.controller.js";

const managers = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN");
export const chatRoutes = createCrudRouter(chatController, [requireAuth], [requireAuth, managers]);
