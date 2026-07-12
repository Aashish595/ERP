import { SqlRepository } from "../core/base.repository.js";
import { StudentAttendanceModel, type StudentAttendanceRecord } from "../models/attendance.model.js";

export class AttendanceRepository extends SqlRepository<StudentAttendanceRecord> {
  constructor() { super(StudentAttendanceModel); }
}

export const attendanceRepository = new AttendanceRepository();
