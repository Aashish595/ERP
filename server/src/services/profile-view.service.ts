import { activeAcademicSessionId } from "../auth.js";
import { query } from "../db.js";
import { ApiError } from "../errors.js";
import type { AuthenticatedRequest, UserRole } from "../types.js";

type Row = Record<string, any>;

const ADMIN_ROLES = new Set<UserRole>(["SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN"]);

const EDITABLE_FIELDS: Record<UserRole, string[]> = {
  SUPER_ADMIN: ["full_name", "email", "phone"],
  SCHOOL_OWNER: ["full_name", "email", "phone"],
  SCHOOL_ADMIN: ["full_name", "email", "phone"],
  TEACHER: ["phone", "address"],
  STUDENT: ["phone", "address", "photo_url"],
  PARENT: ["phone", "alternate_phone", "occupation", "address"],
};

function clean(value: unknown) {
  return value === "" ? null : value;
}

function uniqueNumbers(values: Array<number | null | undefined>) {
  return [...new Set(values.filter((value): value is number => Number.isInteger(value)))];
}

function studentMatchesLink(student: Row, link: Row) {
  if (Number(student.class_id) !== Number(link.class_id)) return false;
  if (link.section_id != null) return Number(student.section_id) === Number(link.section_id);
  const assignedSection = String(link.section_name || "").trim().toLowerCase();
  if (!assignedSection || assignedSection === "all sections") return true;
  return String(student.section_name || "").trim().toLowerCase() === assignedSection;
}

async function loadStudentRows(schoolId: number, sessionId: number | null, options: { userId?: number; guardianIds?: number[]; classIds?: number[] } = {}) {
  const values: unknown[] = [schoolId, sessionId];
  const conditions = ["s.school_id=$1", "s.is_active=true", "($2::int IS NULL OR s.academic_session_id=$2)"];
  if (options.userId != null) {
    values.push(options.userId);
    conditions.push(`s.user_id=$${values.length}`);
  }
  if (options.guardianIds) {
    if (!options.guardianIds.length) return [];
    values.push(options.guardianIds);
    conditions.push(`s.guardian_id=ANY($${values.length}::int[])`);
  }
  if (options.classIds) {
    if (!options.classIds.length) return [];
    values.push(options.classIds);
    conditions.push(`s.class_id=ANY($${values.length}::int[])`);
  }
  return (await query<Row>(
    `SELECT s.id,s.user_id,s.guardian_id,s.class_id,s.section_id,
            COALESCE(se.name,s.section_name) section_name,s.admission_no,s.roll_number,
            concat_ws(' ',s.first_name,s.last_name) name,s.email,s.phone,s.gender,s.date_of_birth,
            s.blood_group,s.photo_url,s.address,s.admission_date,s.status,s.is_active,c.name class_name
       FROM students s
       LEFT JOIN school_classes c ON c.id=s.class_id
       LEFT JOIN sections se ON se.id=s.section_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY s.first_name,s.last_name,s.admission_no`,
    values,
  )).rows;
}

async function loadTeacherLinks(
  schoolId: number,
  sessionId: number | null,
  options: { teacherId?: number; classIds?: number[] } = {},
) {
  if (options.classIds && !options.classIds.length) return { classTeachers: [], subjectTeachers: [] };
  const values: unknown[] = [schoolId, sessionId];
  const classConditions = ["a.school_id=$1", "($2::int IS NULL OR a.academic_session_id=$2)"];
  const subjectConditions = ["a.school_id=$1", "($2::int IS NULL OR a.academic_session_id=$2)"];
  if (options.teacherId != null) {
    values.push(options.teacherId);
    classConditions.push(`a.teacher_id=$${values.length}`);
    subjectConditions.push(`a.teacher_id=$${values.length}`);
  }
  if (options.classIds) {
    values.push(options.classIds);
    classConditions.push(`a.class_id=ANY($${values.length}::int[])`);
    subjectConditions.push(`a.class_id=ANY($${values.length}::int[])`);
  }

  const [classTeachers, subjectTeachers] = await Promise.all([
    query<Row>(
      `SELECT a.id,a.teacher_id,t.full_name teacher_name,a.class_id,c.name class_name,
              a.section_id,COALESCE(se.name,a.section_name,'All Sections') section_name,
              a.academic_session_id,ses.name academic_session_name
         FROM class_teacher_assignments a
         JOIN teachers t ON t.id=a.teacher_id
         JOIN school_classes c ON c.id=a.class_id
         LEFT JOIN sections se ON se.id=a.section_id
         LEFT JOIN academic_sessions ses ON ses.id=a.academic_session_id
        WHERE ${classConditions.join(" AND ")}
        ORDER BY c.name,section_name,t.full_name`,
      values,
    ),
    query<Row>(
      `SELECT a.id,a.teacher_id,t.full_name teacher_name,a.subject_id,sub.name subject_name,
              a.class_id,c.name class_name,a.section_id,
              COALESCE(se.name,a.section_name,'All Sections') section_name
         FROM teacher_subjects a
         JOIN teachers t ON t.id=a.teacher_id
         JOIN subjects sub ON sub.id=a.subject_id
         LEFT JOIN school_classes c ON c.id=a.class_id
         LEFT JOIN sections se ON se.id=a.section_id
        WHERE ${subjectConditions.join(" AND ")}
        ORDER BY c.name,section_name,sub.name,t.full_name`,
      values,
    ),
  ]);
  return { classTeachers: classTeachers.rows, subjectTeachers: subjectTeachers.rows };
}

async function loadGuardiansForUser(schoolId: number, userId: number, email: string) {
  let rows = (await query<Row>(
    "SELECT * FROM parent_guardians WHERE school_id=$1 AND user_id=$2 AND is_active=true ORDER BY id",
    [schoolId, userId],
  )).rows;
  if (!rows.length && email) {
    rows = (await query<Row>(
      "SELECT * FROM parent_guardians WHERE school_id=$1 AND lower(email)=lower($2) AND is_active=true ORDER BY id",
      [schoolId, email],
    )).rows;
  }
  return rows;
}

function linksForStudent(student: Row, links: { classTeachers: Row[]; subjectTeachers: Row[] }) {
  return {
    class_teachers: links.classTeachers.filter((item) => studentMatchesLink(student, item)),
    subject_teachers: links.subjectTeachers.filter((item) => studentMatchesLink(student, item)),
  };
}

async function buildStudentRoleData(schoolId: number, sessionId: number | null, userId: number) {
  const student = (await loadStudentRows(schoolId, sessionId, { userId }))[0] ?? null;
  if (!student) return { student: null, message: "Student profile is not linked to this login yet." };
  const [guardian, links] = await Promise.all([
    student.guardian_id
      ? query<Row>("SELECT * FROM parent_guardians WHERE id=$1 AND school_id=$2", [student.guardian_id, schoolId]).then((result) => result.rows[0] ?? null)
      : Promise.resolve(null),
    loadTeacherLinks(schoolId, sessionId, { classIds: uniqueNumbers([student.class_id]) }),
  ]);
  return { student, guardian, ...linksForStudent(student, links) };
}

async function buildParentRoleData(schoolId: number, sessionId: number | null, userId: number, email: string) {
  const guardians = await loadGuardiansForUser(schoolId, userId, email);
  const children = await loadStudentRows(schoolId, sessionId, { guardianIds: guardians.map((item) => Number(item.id)) });
  const links = await loadTeacherLinks(schoolId, sessionId, { classIds: uniqueNumbers(children.map((item) => item.class_id)) });
  return {
    guardian: guardians[0] ?? null,
    guardians,
    children: children.map((student) => ({ ...student, ...linksForStudent(student, links) })),
    children_count: children.length,
    message: guardians.length ? null : "No guardian record is linked to this parent login yet.",
  };
}

async function buildTeacherRoleData(schoolId: number, sessionId: number | null, userId: number) {
  const teacher = (await query<Row>(
    `SELECT t.id,t.user_id,t.department_id,t.employee_id,t.full_name name,t.email,t.phone,t.gender,
            t.qualification,t.specialization,t.joining_date,t.photo_url,t.address,t.status,t.is_active
       FROM teachers t
      WHERE t.school_id=$1 AND t.user_id=$2 AND t.is_active=true
        AND ($3::int IS NULL OR t.academic_session_id=$3)
      ORDER BY t.id DESC LIMIT 1`,
    [schoolId, userId, sessionId],
  )).rows[0] ?? null;
  if (!teacher) return { teacher: null, assigned_classes: [], subject_assignments: [], class_teacher_assignments: [], message: "Teacher profile is not linked to this login yet." };

  const links = await loadTeacherLinks(schoolId, sessionId, { teacherId: Number(teacher.id) });
  const scopes = new Map<string, Row>();
  for (const item of [...links.classTeachers, ...links.subjectTeachers]) {
    const key = `${item.class_id}:${item.section_id ?? item.section_name ?? "all"}`;
    if (!scopes.has(key)) scopes.set(key, item);
  }
  const students = await loadStudentRows(schoolId, sessionId, { classIds: uniqueNumbers([...scopes.values()].map((item) => item.class_id)) });
  const assignedClasses = [...scopes.values()].map((scope) => {
    const scopedStudents = students.filter((student) => studentMatchesLink(student, scope));
    return {
      class_id: scope.class_id,
      class_name: scope.class_name,
      section_id: scope.section_id,
      section_name: scope.section_name,
      total_students: scopedStudents.length,
      students: scopedStudents,
    };
  });
  return {
    teacher,
    class_teacher_assignments: links.classTeachers,
    subject_assignments: links.subjectTeachers,
    assigned_classes: assignedClasses,
  };
}

async function buildAdminRoleData(schoolId: number, sessionId: number | null) {
  const [classesResult, sectionsResult, students, teachersResult, subjectsResult] = await Promise.all([
    query<Row>(
      "SELECT id,name,code,is_active FROM school_classes WHERE school_id=$1 AND is_active=true AND ($2::int IS NULL OR academic_session_id=$2) ORDER BY name",
      [schoolId, sessionId],
    ),
    query<Row>(
      "SELECT id,name,class_id,is_active FROM sections WHERE school_id=$1 AND is_active=true AND ($2::int IS NULL OR academic_session_id=$2) ORDER BY class_id,name",
      [schoolId, sessionId],
    ),
    loadStudentRows(schoolId, sessionId),
    query<Row>(
      `SELECT id,employee_id,full_name name,email,phone,department_id,specialization,status,is_active
         FROM teachers WHERE school_id=$1 AND is_active=true AND ($2::int IS NULL OR academic_session_id=$2) ORDER BY full_name`,
      [schoolId, sessionId],
    ),
    query<Row>(
      `SELECT sub.id,sub.name,sub.code,sub.class_id,c.name class_name,sub.is_active
         FROM subjects sub LEFT JOIN school_classes c ON c.id=sub.class_id
        WHERE sub.school_id=$1 AND sub.is_active=true AND ($2::int IS NULL OR sub.academic_session_id=$2)
        ORDER BY sub.name`,
      [schoolId, sessionId],
    ),
  ]);
  const classes = classesResult.rows;
  const sections = sectionsResult.rows;
  const links = await loadTeacherLinks(schoolId, sessionId, { classIds: classes.map((item) => Number(item.id)) });
  return {
    classes: classes.map((schoolClass) => ({
      ...schoolClass,
      sections: sections.filter((item) => Number(item.class_id) === Number(schoolClass.id)),
      students: students.filter((item) => Number(item.class_id) === Number(schoolClass.id)),
      total_students: students.filter((item) => Number(item.class_id) === Number(schoolClass.id)).length,
      class_teachers: links.classTeachers.filter((item) => Number(item.class_id) === Number(schoolClass.id)),
      subject_teachers: links.subjectTeachers.filter((item) => Number(item.class_id) === Number(schoolClass.id)),
    })),
    teachers: teachersResult.rows,
    subjects: subjectsResult.rows,
    counts: {
      students: students.length,
      teachers: teachersResult.rows.length,
      classes: classes.length,
      subjects: subjectsResult.rows.length,
      parents: new Set(students.map((item) => item.guardian_id).filter(Boolean)).size,
    },
  };
}

export async function getProfileView(req: AuthenticatedRequest) {
  const account = (await query<Row>(
    "SELECT id,school_id,full_name,email,phone,login_id,role,must_change_password FROM users WHERE id=$1 LIMIT 1",
    [req.user.id],
  )).rows[0];
  if (!account) throw new ApiError(404, "Account not found");

  const school = account.school_id
    ? (await query<Row>("SELECT id,name,school_code,institution_type FROM schools WHERE id=$1", [account.school_id])).rows[0] ?? null
    : null;
  const response: Row = {
    account,
    school,
    editable_fields: EDITABLE_FIELDS[account.role as UserRole] ?? [],
    summary: {},
    role_data: {},
  };
  if (!account.school_id) return response;

  const sessionId = await activeAcademicSessionId(req);
  const session = sessionId
    ? (await query<Row>("SELECT id,name FROM academic_sessions WHERE id=$1 AND school_id=$2", [sessionId, account.school_id])).rows[0] ?? null
    : null;
  response.summary = { academic_session_id: sessionId, academic_session_name: session?.name ?? null };

  if (account.role === "STUDENT") {
    response.role_data = await buildStudentRoleData(account.school_id, sessionId, account.id);
  } else if (account.role === "TEACHER") {
    response.role_data = await buildTeacherRoleData(account.school_id, sessionId, account.id);
  } else if (account.role === "PARENT") {
    response.role_data = await buildParentRoleData(account.school_id, sessionId, account.id, account.email);
  } else if (ADMIN_ROLES.has(account.role)) {
    const admin = await buildAdminRoleData(account.school_id, sessionId);
    response.role_data = { classes: admin.classes, teachers: admin.teachers, subjects: admin.subjects };
    response.summary = { ...response.summary, ...admin.counts };
  }
  return response;
}

export async function updateProfileView(req: AuthenticatedRequest, payload: Row) {
  const role = req.user.role;
  const allowed = EDITABLE_FIELDS[role] ?? [];
  const supplied = Object.keys(payload).filter((key) => payload[key] !== undefined);
  const blocked = supplied.filter((key) => !allowed.includes(key));
  if (blocked.length) throw new ApiError(400, `These fields cannot be edited here: ${blocked.join(", ")}`);
  const fields = supplied.filter((key) => allowed.includes(key));
  if (!fields.length) return getProfileView(req);

  if (ADMIN_ROLES.has(role)) {
    if (payload.full_name === "" || payload.email === "") throw new ApiError(422, "Name and email cannot be empty");
    await query(
      `UPDATE users SET ${fields.map((field, index) => `${field}=$${index + 1}`).join(",")},updated_at=NOW() WHERE id=$${fields.length + 1}`,
      [...fields.map((field) => clean(payload[field])), req.user.id],
    );
  } else if (role === "STUDENT") {
    const studentFields = fields.filter((field) => ["phone", "address", "photo_url"].includes(field));
    const result = await query(
      `UPDATE students SET ${studentFields.map((field, index) => `${field}=$${index + 1}`).join(",")},updated_at=NOW() WHERE user_id=$${studentFields.length + 1} AND school_id=$${studentFields.length + 2} RETURNING id`,
      [...studentFields.map((field) => clean(payload[field])), req.user.id, req.user.school_id],
    );
    if (!result.rowCount) throw new ApiError(404, "Student profile is not linked to this login yet");
    if (fields.includes("phone")) await query("UPDATE users SET phone=$1,updated_at=NOW() WHERE id=$2", [clean(payload.phone), req.user.id]);
  } else if (role === "TEACHER") {
    const teacherFields = fields.filter((field) => ["phone", "address"].includes(field));
    const result = await query(
      `UPDATE teachers SET ${teacherFields.map((field, index) => `${field}=$${index + 1}`).join(",")},updated_at=NOW() WHERE user_id=$${teacherFields.length + 1} AND school_id=$${teacherFields.length + 2} RETURNING id`,
      [...teacherFields.map((field) => clean(payload[field])), req.user.id, req.user.school_id],
    );
    if (!result.rowCount) throw new ApiError(404, "Teacher profile is not linked to this login yet");
    if (fields.includes("phone")) await query("UPDATE users SET phone=$1,updated_at=NOW() WHERE id=$2", [clean(payload.phone), req.user.id]);
  } else if (role === "PARENT") {
    const guardianFields = fields.filter((field) => ["phone", "alternate_phone", "occupation", "address"].includes(field));
    const result = await query(
      `UPDATE parent_guardians SET ${guardianFields.map((field, index) => `${field}=$${index + 1}`).join(",")},updated_at=NOW() WHERE user_id=$${guardianFields.length + 1} AND school_id=$${guardianFields.length + 2} RETURNING id`,
      [...guardianFields.map((field) => clean(payload[field])), req.user.id, req.user.school_id],
    );
    if (!result.rowCount) throw new ApiError(404, "Guardian profile is not linked to this login yet");
    if (fields.includes("phone")) await query("UPDATE users SET phone=$1,updated_at=NOW() WHERE id=$2", [clean(payload.phone), req.user.id]);
  }
  return getProfileView(req);
}
