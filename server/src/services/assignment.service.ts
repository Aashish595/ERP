import { CrudService } from "../core/base.service.js";
import type { AssignmentRecord } from "../models/assignment.model.js";
import { assignmentRepository } from "../repositories/assignment.repository.js";

export class AssignmentService extends CrudService<AssignmentRecord> {}
export const assignmentService = new AssignmentService(assignmentRepository);
