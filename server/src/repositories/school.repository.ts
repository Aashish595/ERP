import { SqlRepository } from "../core/base.repository.js";
import { SchoolModel, type SchoolRecord } from "../models/school.model.js";

export class SchoolRepository extends SqlRepository<SchoolRecord> {
  constructor() { super(SchoolModel); }
}

export const schoolRepository = new SchoolRepository();
