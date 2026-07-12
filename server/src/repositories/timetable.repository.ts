import { SqlRepository } from "../core/base.repository.js";
import { TimetableEntryModel, type TimetableEntryRecord } from "../models/timetable.model.js";

export class TimetableRepository extends SqlRepository<TimetableEntryRecord> {
  constructor() { super(TimetableEntryModel); }
}

export const timetableRepository = new TimetableRepository();
