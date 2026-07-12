import { SqlRepository } from "../core/base.repository.js";
import { StudentModel, type StudentRecord } from "../models/people.model.js";

export class PeopleRepository extends SqlRepository<StudentRecord> {
  constructor() { super(StudentModel); }
}

export const peopleRepository = new PeopleRepository();
