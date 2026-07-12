import { CrudController } from "../../core/base.controller.js";
import type { AssignmentRecord } from "../../models/assignment.model.js";
import { assignmentService } from "../../services/assignment.service.js";

export class AssignmentController extends CrudController<AssignmentRecord> {}
export const assignmentController = new AssignmentController(assignmentService);
