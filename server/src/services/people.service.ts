import { CrudService } from "../core/base.service.js";
import type { StudentRecord } from "../models/people.model.js";
import { peopleRepository } from "../repositories/people.repository.js";

export class PeopleService extends CrudService<StudentRecord> {}
export const peopleService = new PeopleService(peopleRepository);
