import { createPayloadSchema, createUpdateSchema } from "../core/model.validation.js";
import { StudentAttendanceModel } from "../models/attendance.model.js";

export const createAttendanceSchema = createPayloadSchema(StudentAttendanceModel);
export const updateAttendanceSchema = createUpdateSchema(StudentAttendanceModel);
