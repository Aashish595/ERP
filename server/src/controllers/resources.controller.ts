import { Router, type Request, type Response } from "express";
import { activeAcademicSessionId, allowRoles, requireAuth, schoolId } from "../auth.js";
import { invalidateSchoolCache } from "../cache.js";
import { query, transaction } from "../db.js";
import { ApiError } from "../errors.js";
import { createResource, deleteResource, listResource, updateResource, type ResourceDefinition } from "../repository.js";
import type { AuthenticatedRequest } from "../types.js";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

export const resourceRouter = Router();
resourceRouter.use(requireAuth);
const managers = allowRoles("SUPER_ADMIN", "SCHOOL_ADMIN", "SCHOOL_OWNER");

function asyncRoute(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: import("express").NextFunction) => void fn(req, res).catch(next);
}

function mountCrud(path: string, definition: ResourceDefinition, options: { readRoles?: string[]; writeMiddleware?: any } = {}) {
  resourceRouter.get(path, asyncRoute(async (req, res) => res.json(await listResource(definition, req))));
  resourceRouter.post(path, options.writeMiddleware ?? managers, asyncRoute(async (req, res) => {
    const body = { ...req.body };
    if (definition.sessionScoped && !body.academic_session_id) body.academic_session_id = await activeAcademicSessionId(req);
    const row = await createResource(definition, body, req);
    await invalidateSchoolCache(schoolId(req));
    res.status(201).json(row);
  }));
  resourceRouter.put(`${path}/:id`, options.writeMiddleware ?? managers, asyncRoute(async (req, res) => {
    const row = await updateResource(definition, Number(req.params.id), req.body, req);
    await invalidateSchoolCache(schoolId(req));
    res.json(row);
  }));
  resourceRouter.patch(`${path}/:id`, options.writeMiddleware ?? managers, asyncRoute(async (req, res) => {
    const row = await updateResource(definition, Number(req.params.id), req.body, req);
    await invalidateSchoolCache(schoolId(req));
    res.json(row);
  }));
  resourceRouter.delete(`${path}/:id`, options.writeMiddleware ?? managers, asyncRoute(async (req, res) => {
    res.json(await deleteResource(definition, Number(req.params.id), req));
    await invalidateSchoolCache(schoolId(req));
  }));
}

const academicSession: ResourceDefinition = { table: "academic_sessions", fields: ["name", "start_date", "end_date", "is_active"], softDelete: false };
resourceRouter.get("/academic-sessions", asyncRoute(async (req, res) => res.json(await listResource(academicSession, req))));
resourceRouter.post("/academic-sessions", managers, asyncRoute(async (req, res) => {
  const sid = schoolId(req);
  const row = await transaction(async (client) => {
    if (req.body.is_active) await client.query("UPDATE academic_sessions SET is_active=false WHERE school_id=$1", [sid]);
    const result = await client.query("INSERT INTO academic_sessions(school_id,name,start_date,end_date,is_active) VALUES($1,$2,$3,$4,$5) RETURNING *", [sid, req.body.name, req.body.start_date ?? null, req.body.end_date ?? null, Boolean(req.body.is_active)]);
    return result.rows[0];
  });
  res.status(201).json(row);
}));
resourceRouter.put("/academic-sessions/:id", managers, asyncRoute(async (req, res) => {
  const sid = schoolId(req);
  const row = await transaction(async (client) => {
    if (req.body.is_active) await client.query("UPDATE academic_sessions SET is_active=false WHERE school_id=$1", [sid]);
    const result = await client.query(
      `UPDATE academic_sessions SET name=COALESCE($1,name),start_date=COALESCE($2,start_date),end_date=COALESCE($3,end_date),is_active=COALESCE($4,is_active)
       WHERE id=$5 AND school_id=$6 RETURNING *`,
      [req.body.name, req.body.start_date, req.body.end_date, req.body.is_active, Number(req.params.id), sid],
    );
    if (!result.rows[0]) throw new ApiError(404, "Academic session not found");
    return result.rows[0];
  });
  res.json(row);
}));
resourceRouter.delete("/academic-sessions/:id", managers, asyncRoute(async (req, res) => res.json(await deleteResource(academicSession, Number(req.params.id), req))));

mountCrud("/departments", { table: "departments", fields: ["academic_session_id", "name", "code", "description", "is_active"], sessionScoped: true });
mountCrud("/classes", { table: "school_classes", fields: ["academic_session_id", "department_id", "name", "code", "sections", "is_active"], sessionScoped: true });
mountCrud("/sections", { table: "sections", fields: ["academic_session_id", "class_id", "name", "is_active"], sessionScoped: true });
mountCrud("/subjects", { table: "subjects", fields: ["academic_session_id", "department_id", "class_id", "name", "code", "sections", "is_active"], sessionScoped: true });

const studentFields = ["academic_session_id", "user_id", "guardian_id", "class_id", "section_id", "section_name", "admission_no", "roll_number", "first_name", "last_name", "email", "phone", "gender", "date_of_birth", "blood_group", "photo_url", "address", "admission_date", "status", "is_active"] as const;
resourceRouter.get("/students", asyncRoute(async (req, res) => {
  const rows = await listResource({ table: "students", fields: studentFields }, req);
  const ids = rows.map((row: any) => row.guardian_id).filter(Boolean);
  const guardians = ids.length ? (await query<any>("SELECT * FROM parent_guardians WHERE id=ANY($1::int[])", [ids])).rows : [];
  const byId = new Map(guardians.map((g) => [g.id, g]));
  res.json(rows.map((row: any) => ({ ...row, guardian: byId.get(row.guardian_id) ?? null })));
}));
resourceRouter.get("/students/:id", asyncRoute(async (req, res) => {
  const result = await query<any>(
    `SELECT s.*,row_to_json(g) AS guardian FROM students s LEFT JOIN parent_guardians g ON g.id=s.guardian_id
     WHERE s.id=$1 AND s.school_id=$2 LIMIT 1`, [Number(req.params.id), schoolId(req)],
  );
  if (!result.rows[0]) throw new ApiError(404, "Student not found");
  res.json(result.rows[0]);
}));
resourceRouter.post("/students", managers, asyncRoute(async (req, res) => {
  const sid = schoolId(req);
  const tempPassword = randomBytes(5).toString("base64url");
  const row = await transaction(async (client) => {
    let userId = req.body.user_id ?? null;
    if (!userId && req.body.email) {
      const user = await client.query<{ id: number }>(
        `INSERT INTO users(school_id,full_name,email,phone,login_id,hashed_password,role,must_change_password)
         VALUES($1,$2,$3,$4,$5,$6,'STUDENT',true) RETURNING id`,
        [sid, `${req.body.first_name} ${req.body.last_name ?? ""}`.trim(), req.body.email.toLowerCase(), req.body.phone, (req.body.admission_no || req.body.email).toLowerCase(), await bcrypt.hash(tempPassword, 12)],
      );
      userId = user.rows[0]!.id;
    }
    const data = { ...req.body, user_id: userId, academic_session_id: req.body.academic_session_id ?? await activeAcademicSessionId(req) };
    const columns = studentFields.filter((field) => data[field] !== undefined);
    const values = columns.map((field) => data[field]);
    const result = await client.query(`INSERT INTO students(school_id,${columns.join(",")}) VALUES($1,${columns.map((_, i) => `$${i + 2}`).join(",")}) RETURNING *`, [sid, ...values]);
    return result.rows[0];
  });
  res.status(201).json({ ...row, temporary_password: req.body.email ? tempPassword : null });
}));
resourceRouter.put("/students/:id", managers, asyncRoute(async (req, res) => res.json(await updateResource({ table: "students", fields: studentFields }, Number(req.params.id), req.body, req))));
resourceRouter.patch("/students/:id/suspend", managers, asyncRoute(async (req, res) => {
  const row = await updateResource({ table: "students", fields: studentFields }, Number(req.params.id), { status: "SUSPENDED", is_active: false }, req);
  res.json(row);
}));
resourceRouter.patch("/students/:id/activate", managers, asyncRoute(async (req, res) => {
  const row = await updateResource({ table: "students", fields: studentFields }, Number(req.params.id), { status: "ACTIVE", is_active: true }, req);
  res.json(row);
}));
resourceRouter.delete("/students/:id", managers, asyncRoute(async (req, res) => {
  const row = await updateResource({ table: "students", fields: studentFields }, Number(req.params.id), { status: "DELETED", is_active: false }, req);
  res.json(row);
}));
resourceRouter.post("/students/:id/parent-login", managers, asyncRoute(async (req, res) => {
  const student = (await query<any>("SELECT * FROM students WHERE id=$1 AND school_id=$2", [Number(req.params.id), schoolId(req)])).rows[0];
  if (!student) throw new ApiError(404, "Student not found");
  const guardian = student.guardian_id ? (await query<any>("SELECT * FROM parent_guardians WHERE id=$1", [student.guardian_id])).rows[0] : null;
  if (!guardian?.email) throw new ApiError(400, "Guardian email is required before creating parent login");
  const password = randomBytes(5).toString("base64url");
  const login = guardian.email.toLowerCase();
  const user = await query<{ id: number }>(
    `INSERT INTO users(school_id,full_name,email,phone,login_id,hashed_password,role,must_change_password)
     VALUES($1,$2,$3,$4,$5,$6,'PARENT',true)
     ON CONFLICT(school_id,login_id) DO UPDATE SET is_active=true RETURNING id`,
    [schoolId(req), guardian.full_name, guardian.email, guardian.phone, login, await bcrypt.hash(password, 12)],
  );
  await query("UPDATE parent_guardians SET user_id=$1 WHERE id=$2", [user.rows[0]!.id, guardian.id]);
  res.json({ ...student, parent_temporary_password: password, parent_login_id: login });
}));

const teacherFields = ["academic_session_id", "user_id", "department_id", "employee_id", "full_name", "email", "phone", "gender", "qualification", "specialization", "joining_date", "photo_url", "address", "status", "is_active"] as const;
resourceRouter.get("/teachers", asyncRoute(async (req, res) => res.json(await listResource({ table: "teachers", fields: teacherFields }, req))));
resourceRouter.post("/teachers", managers, asyncRoute(async (req, res) => {
  const tempPassword = randomBytes(5).toString("base64url");
  const sid = schoolId(req);
  const row = await transaction(async (client) => {
    let userId = req.body.user_id ?? null;
    if (!userId && req.body.email) {
      const result = await client.query<{ id: number }>(
        `INSERT INTO users(school_id,full_name,email,phone,login_id,hashed_password,role,must_change_password)
         VALUES($1,$2,$3,$4,$5,$6,'TEACHER',true) RETURNING id`,
        [sid, req.body.full_name, req.body.email.toLowerCase(), req.body.phone, (req.body.employee_id || req.body.email).toLowerCase(), await bcrypt.hash(tempPassword, 12)],
      );
      userId = result.rows[0]!.id;
    }
    const data = { ...req.body, user_id: userId, academic_session_id: req.body.academic_session_id ?? await activeAcademicSessionId(req) };
    const columns = teacherFields.filter((field) => data[field] !== undefined);
    const result = await client.query(`INSERT INTO teachers(school_id,${columns.join(",")}) VALUES($1,${columns.map((_, i) => `$${i + 2}`).join(",")}) RETURNING *`, [sid, ...columns.map((field) => data[field])]);
    return result.rows[0];
  });
  res.status(201).json({ ...row, temporary_password: req.body.email ? tempPassword : null });
}));
resourceRouter.get("/teachers/class-teachers", asyncRoute(async (req, res) => res.json(await listResource({ table: "class_teacher_assignments", fields: ["teacher_id", "class_id", "section_id", "section_name", "academic_session_id"] }, req))));
resourceRouter.post("/teachers/class-teachers", managers, asyncRoute(async (req, res) => res.status(201).json(await createResource({ table: "class_teacher_assignments", fields: ["teacher_id", "class_id", "section_id", "section_name", "academic_session_id"], hasUpdatedAt: false }, req.body, req))));
resourceRouter.delete("/teachers/class-teachers/:id", managers, asyncRoute(async (req, res) => res.json(await deleteResource({ table: "class_teacher_assignments", fields: [], hasUpdatedAt: false }, Number(req.params.id), req))));
resourceRouter.delete("/teachers/subject-assignments/:id", managers, asyncRoute(async (req, res) => res.json(await deleteResource({ table: "teacher_subjects", fields: [], hasUpdatedAt: false }, Number(req.params.id), req))));
resourceRouter.get("/teachers/me/classes", asyncRoute(async (req, res) => {
  const uid = (req as AuthenticatedRequest).user.id;
  const result = await query(`SELECT DISTINCT c.id,c.name,cta.section_id,cta.section_name FROM teachers t JOIN class_teacher_assignments cta ON cta.teacher_id=t.id JOIN school_classes c ON c.id=cta.class_id WHERE t.user_id=$1`, [uid]);
  res.json(result.rows);
}));
resourceRouter.get("/teachers/me/available-classes", asyncRoute(async (req, res) => {
  const uid = (req as AuthenticatedRequest).user.id;
  const result = await query(`SELECT DISTINCT c.id,c.name,ts.section_id,ts.section_name FROM teachers t JOIN teacher_subjects ts ON ts.teacher_id=t.id JOIN school_classes c ON c.id=ts.class_id WHERE t.user_id=$1`, [uid]);
  res.json(result.rows);
}));
resourceRouter.get("/teachers/:id", asyncRoute(async (req, res) => {
  const row = (await query("SELECT * FROM teachers WHERE id=$1 AND school_id=$2", [Number(req.params.id), schoolId(req)])).rows[0];
  if (!row) throw new ApiError(404, "Teacher not found");
  res.json(row);
}));
resourceRouter.put("/teachers/:id", managers, asyncRoute(async (req, res) => res.json(await updateResource({ table: "teachers", fields: teacherFields }, Number(req.params.id), req.body, req))));
resourceRouter.patch("/teachers/:id/suspend", managers, asyncRoute(async (req, res) => res.json(await updateResource({ table: "teachers", fields: teacherFields }, Number(req.params.id), { status: "SUSPENDED", is_active: false }, req))));
resourceRouter.patch("/teachers/:id/activate", managers, asyncRoute(async (req, res) => res.json(await updateResource({ table: "teachers", fields: teacherFields }, Number(req.params.id), { status: "ACTIVE", is_active: true }, req))));
resourceRouter.delete("/teachers/:id", managers, asyncRoute(async (req, res) => res.json(await updateResource({ table: "teachers", fields: teacherFields }, Number(req.params.id), { status: "DELETED", is_active: false }, req))));
resourceRouter.get("/teachers/:id/subjects", asyncRoute(async (req, res) => {
  const result = await query("SELECT * FROM teacher_subjects WHERE teacher_id=$1 AND school_id=$2 ORDER BY id DESC", [Number(req.params.id), schoolId(req)]);
  res.json(result.rows);
}));
resourceRouter.post("/teachers/:id/subjects", managers, asyncRoute(async (req, res) => res.status(201).json(await createResource({ table: "teacher_subjects", fields: ["teacher_id", "subject_id", "class_id", "section_id", "section_name", "academic_session_id"], hasUpdatedAt: false }, { ...req.body, teacher_id: Number(req.params.id) }, req))));
