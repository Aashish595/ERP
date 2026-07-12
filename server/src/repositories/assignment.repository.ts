import { SqlRepository } from "../core/base.repository.js";
import { AssignmentModel, type AssignmentRecord } from "../models/assignment.model.js";

export class AssignmentRepository extends SqlRepository<AssignmentRecord> {
  constructor() { super(AssignmentModel); }
}

export const assignmentRepository = new AssignmentRepository();
