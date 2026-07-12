import { allowRoles, requireAuth } from "../../auth.js";
import { createCrudRouter } from "../../core/crud.routes.js";
import { feeController } from "../../controllers/domain/fee.controller.js";

const managers = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN");
export const feeRoutes = createCrudRouter(feeController, [requireAuth], [requireAuth, managers]);
