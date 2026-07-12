import { CrudController } from "../../core/base.controller.js";
import type { StudentRecord } from "../../models/people.model.js";
import { peopleService } from "../../services/people.service.js";

export class PeopleController extends CrudController<StudentRecord> {}
export const peopleController = new PeopleController(peopleService);
