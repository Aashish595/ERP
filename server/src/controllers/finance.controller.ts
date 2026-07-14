import { randomBytes } from "node:crypto";
import { Router } from "express";
import { activeAcademicSessionId, allowRoles, requireAuth, schoolId } from "../auth.js";
import { query, transaction } from "../db.js";
import { ApiError } from "../errors.js";
import type { AuthenticatedRequest } from "../types.js";

export const financeRouter=Router();financeRouter.use(requireAuth);
const staff=allowRoles("SUPER_ADMIN","SCHOOL_OWNER","SCHOOL_ADMIN","TEACHER");
const admin=allowRoles("SUPER_ADMIN","SCHOOL_OWNER","SCHOOL_ADMIN");

const examFields=["academic_session_id","class_id","section_id","section_name","name","exam_type","description","start_date","end_date","result_status","is_active"];
function gradeFromPercentage(percentage:number|null){
 if(percentage===null)return "-";
 if(percentage>=90)return "A+";if(percentage>=80)return "A";if(percentage>=70)return "B+";
 if(percentage>=60)return "B";if(percentage>=50)return "C";if(percentage>=40)return "D";return "F";
}
async function examView(examId:number,sid:number){
 return (await query<any>(`SELECT e.*,c.name class_name,COALESCE(sec.name,e.section_name) section_name,a.name academic_session_name,
  (SELECT COUNT(*)::int FROM exam_subjects es WHERE es.exam_id=e.id AND es.is_active=true) subjects_count,
  (SELECT COUNT(*)::int FROM exam_marks em JOIN exam_subjects es ON es.id=em.exam_subject_id WHERE es.exam_id=e.id) marks_entered_count
  FROM exams e JOIN school_classes c ON c.id=e.class_id LEFT JOIN sections sec ON sec.id=e.section_id
  LEFT JOIN academic_sessions a ON a.id=e.academic_session_id WHERE e.id=$1 AND e.school_id=$2`,[examId,sid])).rows[0];
}
financeRouter.get("/exams/meta",staff,async(req,res)=>{
 const sid=schoolId(req);
 const [classes,sections,subjects,teachers,sessions]=await Promise.all([
  query("SELECT id,name,code FROM school_classes WHERE school_id=$1 AND is_active=true ORDER BY name",[sid]),
  query("SELECT id,name,class_id FROM sections WHERE school_id=$1 AND is_active=true ORDER BY name",[sid]),
  query("SELECT id,name,class_id FROM subjects WHERE school_id=$1 AND is_active=true ORDER BY name",[sid]),
  query("SELECT id,full_name name,employee_id FROM teachers WHERE school_id=$1 AND is_active=true ORDER BY full_name",[sid]),
  query("SELECT id,name,is_active FROM academic_sessions WHERE school_id=$1 ORDER BY id DESC",[sid]),
 ]);
 res.json({
  classes:classes.rows.map((item:any)=>({id:item.id,name:item.name,extra:item.code??null})),
  sections:sections.rows.map((item:any)=>({id:item.id,name:item.name,extra:String(item.class_id)})),
  subjects:subjects.rows.map((item:any)=>({id:item.id,name:item.name,extra:item.class_id?String(item.class_id):null})),
  teachers:teachers.rows.map((item:any)=>({id:item.id,name:item.name,extra:item.employee_id??null})),
  academic_sessions:sessions.rows.map((item:any)=>({id:item.id,name:item.name,extra:item.is_active?"Active":null})),
  current_academic_session_id:await activeAcademicSessionId(req),
 });
});
financeRouter.get("/exams",async(req,res)=>{
 const values:unknown[]=[schoolId(req)];let where="e.school_id=$1";
 for(const [queryName,column] of [["class_id","class_id"],["section_id","section_id"],["academic_session_id","academic_session_id"],["result_status","result_status"],["status","result_status"]] as const){
  if(req.query[queryName]){values.push(req.query[queryName]);where+=` AND e.${column}=$${values.length}`;}
 }
 if(req.query.q){values.push(`%${String(req.query.q).trim()}%`);where+=` AND (e.name ILIKE $${values.length} OR COALESCE(e.exam_type,'') ILIKE $${values.length})`;}
 const r=await query(`SELECT e.*,c.name class_name,COALESCE(sec.name,e.section_name) section_name,a.name academic_session_name,
  (SELECT COUNT(*)::int FROM exam_subjects es WHERE es.exam_id=e.id AND es.is_active=true) subjects_count,
  (SELECT COUNT(*)::int FROM exam_marks em JOIN exam_subjects es ON es.id=em.exam_subject_id WHERE es.exam_id=e.id) marks_entered_count
  FROM exams e JOIN school_classes c ON c.id=e.class_id LEFT JOIN sections sec ON sec.id=e.section_id
  LEFT JOIN academic_sessions a ON a.id=e.academic_session_id WHERE ${where} ORDER BY e.start_date DESC NULLS LAST,e.id DESC`,values);
 res.json(r.rows);
});
financeRouter.post("/exams",admin,async(req,res)=>{const data:any={...req.body,academic_session_id:req.body.academic_session_id??await activeAcademicSessionId(req)};const cols=examFields.filter(f=>data[f]!==undefined);const r=await query(`INSERT INTO exams(school_id,${cols.join(",")}) VALUES($1,${cols.map((_,i)=>`$${i+2}`).join(",")}) RETURNING *`,[schoolId(req),...cols.map(f=>data[f])]);res.status(201).json(r.rows[0]);});
financeRouter.put("/exams/:id",admin,async(req,res)=>{const cols=examFields.filter(f=>req.body[f]!==undefined);const r=await query(`UPDATE exams SET ${cols.map((f,i)=>`${f}=$${i+1}`).join(",")},updated_at=NOW() WHERE id=$${cols.length+1} AND school_id=$${cols.length+2} RETURNING *`,[...cols.map(f=>req.body[f]),Number(req.params.id),schoolId(req)]);if(!r.rows[0])throw new ApiError(404,"Exam not found");res.json(r.rows[0]);});
financeRouter.delete("/exams/:id",admin,async(req,res)=>{const r=await query("DELETE FROM exams WHERE id=$1 AND school_id=$2 RETURNING id",[Number(req.params.id),schoolId(req)]);if(!r.rowCount)throw new ApiError(404,"Exam not found");res.json({message:"Exam deleted"});});
for(const action of ["publish","unpublish"] as const)financeRouter.post(`/exams/:id/${action}`,admin,async(req,res)=>{const status=action==="publish"?"PUBLISHED":"DRAFT";const r=await query("UPDATE exams SET result_status=$1,published_at=$2,updated_at=NOW() WHERE id=$3 AND school_id=$4 RETURNING *",[status,action==="publish"?new Date():null,Number(req.params.id),schoolId(req)]);if(!r.rows[0])throw new ApiError(404,"Exam not found");res.json(r.rows[0]);});
financeRouter.get("/exams/:id/subjects",async(req,res)=>{
 const r=await query(`SELECT es.*,s.name subject_name,t.full_name teacher_name,
  (SELECT COUNT(*)::int FROM exam_marks em WHERE em.exam_subject_id=es.id) marks_entered_count
  FROM exam_subjects es JOIN subjects s ON s.id=es.subject_id LEFT JOIN teachers t ON t.id=es.teacher_id
  WHERE es.exam_id=$1 AND es.school_id=$2 ORDER BY es.exam_date NULLS LAST,s.name`,[Number(req.params.id),schoolId(req)]);
 res.json(r.rows);
});
financeRouter.get("/exams/:id/timetable",async(req,res)=>{
 const r=await query(`SELECT e.id exam_id,e.name exam_name,e.exam_type,e.result_status,e.class_id,e.section_id,
  c.name class_name,COALESCE(sec.name,e.section_name) section_name,e.start_date,e.end_date,
  es.id exam_subject_id,es.subject_id,s.name subject_name,es.teacher_id,t.full_name teacher_name,
  es.max_marks,es.pass_marks,es.exam_date,es.start_time,es.end_time,es.room,es.timetable_note,
  'MANUAL'::text schedule_source
  FROM exam_subjects es JOIN exams e ON e.id=es.exam_id JOIN school_classes c ON c.id=e.class_id
  LEFT JOIN sections sec ON sec.id=e.section_id JOIN subjects s ON s.id=es.subject_id
  LEFT JOIN teachers t ON t.id=es.teacher_id WHERE es.exam_id=$1 AND es.school_id=$2
  ORDER BY es.exam_date NULLS LAST,es.start_time NULLS LAST,s.name`,[Number(req.params.id),schoolId(req)]);
 res.json(r.rows);
});
financeRouter.post("/exams/:id/auto-schedule-timetable",admin,async(req,res)=>{const exam=(await query<any>("SELECT * FROM exams WHERE id=$1 AND school_id=$2",[Number(req.params.id),schoolId(req)])).rows[0];if(!exam)throw new ApiError(404,"Exam not found");const subjects=await query<any>("SELECT * FROM exam_subjects WHERE exam_id=$1 ORDER BY id",[exam.id]);let day=new Date(req.query.start_date as string||exam.start_date||Date.now());for(const [i,s] of subjects.rows.entries()){while([0,6].includes(day.getDay()))day.setDate(day.getDate()+1);await query("UPDATE exam_subjects SET exam_date=$1,start_time=COALESCE(start_time,$2),end_time=COALESCE(end_time,$3) WHERE id=$4",[day.toISOString().slice(0,10),req.query.start_time??"09:00",req.query.end_time??"12:00",s.id]);day.setDate(day.getDate()+1);}res.json((await query("SELECT * FROM exam_subjects WHERE exam_id=$1 ORDER BY exam_date",[exam.id])).rows);});
const examSubjectFields=["subject_id","teacher_id","max_marks","pass_marks","exam_date","start_time","end_time","room","timetable_note","is_active"];
financeRouter.post("/exams/:id/subjects",admin,async(req,res)=>{const cols=examSubjectFields.filter(f=>req.body[f]!==undefined);const r=await query(`INSERT INTO exam_subjects(school_id,exam_id,${cols.join(",")}) VALUES($1,$2,${cols.map((_,i)=>`$${i+3}`).join(",")}) RETURNING *`,[schoolId(req),Number(req.params.id),...cols.map(f=>req.body[f])]);res.status(201).json(r.rows[0]);});
financeRouter.put("/exams/:id/subjects/:subjectId",admin,async(req,res)=>{const cols=examSubjectFields.filter(f=>req.body[f]!==undefined);const r=await query(`UPDATE exam_subjects SET ${cols.map((f,i)=>`${f}=$${i+1}`).join(",")},updated_at=NOW() WHERE id=$${cols.length+1} AND exam_id=$${cols.length+2} AND school_id=$${cols.length+3} RETURNING *`,[...cols.map(f=>req.body[f]),Number(req.params.subjectId),Number(req.params.id),schoolId(req)]);if(!r.rows[0])throw new ApiError(404,"Exam subject not found");res.json(r.rows[0]);});
financeRouter.delete("/exams/:id/subjects/:subjectId",admin,async(req,res)=>{const r=await query("DELETE FROM exam_subjects WHERE id=$1 AND exam_id=$2 AND school_id=$3 RETURNING id",[Number(req.params.subjectId),Number(req.params.id),schoolId(req)]);if(!r.rowCount)throw new ApiError(404,"Exam subject not found");res.json({message:"Exam subject deleted"});});
financeRouter.get("/exams/:id/students",staff,async(req,res)=>{const r=await query(`SELECT s.* FROM students s JOIN exams e ON e.class_id=s.class_id AND (e.section_id IS NULL OR e.section_id=s.section_id) WHERE e.id=$1 AND e.school_id=$2 AND s.is_active=true`,[Number(req.params.id),schoolId(req)]);res.json(r.rows);});
financeRouter.get("/exams/:id/marks",staff,async(req,res)=>{
 const examId=Number(req.params.id),sid=schoolId(req),subjectId=Number(req.query.exam_subject_id);
 if(Number.isInteger(subjectId)&&subjectId>0){
  const r=await query(`SELECT em.id,es.id exam_subject_id,es.subject_id,su.name subject_name,
   st.id student_id,concat_ws(' ',st.first_name,st.last_name) student_name,st.admission_no,st.roll_number,
   em.marks_obtained,es.max_marks,es.pass_marks,em.grade,COALESCE(em.is_absent,false) is_absent,
   COALESCE(em.pass_status,'PENDING') pass_status,em.remarks,em.updated_at
   FROM exams e JOIN exam_subjects es ON es.exam_id=e.id AND es.id=$3 JOIN subjects su ON su.id=es.subject_id
   JOIN students st ON st.school_id=e.school_id AND st.class_id=e.class_id AND (e.section_id IS NULL OR st.section_id=e.section_id)
   LEFT JOIN exam_marks em ON em.exam_subject_id=es.id AND em.student_id=st.id
   WHERE e.id=$1 AND e.school_id=$2 AND st.is_active=true ORDER BY st.roll_number NULLS LAST,st.first_name`,[examId,sid,subjectId]);
  return res.json(r.rows);
 }
 const r=await query(`SELECT em.*,es.subject_id,su.name subject_name,es.max_marks,es.pass_marks,
  concat_ws(' ',st.first_name,st.last_name) student_name,st.admission_no,st.roll_number
  FROM exam_marks em JOIN exam_subjects es ON es.id=em.exam_subject_id JOIN subjects su ON su.id=es.subject_id
  JOIN students st ON st.id=em.student_id WHERE es.exam_id=$1 AND em.school_id=$2 ORDER BY st.first_name`,[examId,sid]);
 res.json(r.rows);
});
financeRouter.post("/exams/:id/marks/bulk",staff,async(req,res)=>{
 const input=Array.isArray(req.body?.marks)?req.body.marks:Array.isArray(req.body)?req.body:[];
 const rows=await transaction(async client=>{const out=[];for(const item of input){
  const subject=(await client.query<any>("SELECT max_marks,pass_marks FROM exam_subjects WHERE id=$1 AND exam_id=$2 AND school_id=$3",[item.exam_subject_id,Number(req.params.id),schoolId(req)])).rows[0];
  if(!subject)throw new ApiError(404,"Exam subject not found");
  const absent=Boolean(item.is_absent);const marks=absent||item.marks_obtained===null||item.marks_obtained===undefined?null:Number(item.marks_obtained);
  if(marks!==null&&(marks<0||marks>Number(subject.max_marks)))throw new ApiError(400,"Marks obtained must be between 0 and max marks");
  const pass=absent?"ABSENT":marks===null?"PENDING":marks>=Number(subject.pass_marks)?"PASS":"FAIL";
  const grade=absent?"ABS":marks===null?null:gradeFromPercentage(marks/Number(subject.max_marks)*100);
  const r=await client.query(`INSERT INTO exam_marks(school_id,exam_subject_id,student_id,marks_obtained,grade,is_absent,pass_status,remarks) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(school_id,exam_subject_id,student_id) DO UPDATE SET marks_obtained=$4,grade=$5,is_absent=$6,pass_status=$7,remarks=$8,updated_at=NOW() RETURNING *`,[schoolId(req),item.exam_subject_id,item.student_id,marks,grade,absent,pass,item.remarks??null]);out.push(r.rows[0]);
 }return out;});res.json(rows);
});
financeRouter.get("/exams/:id/class-result",async(req,res)=>{
 const examId=Number(req.params.id),sid=schoolId(req);const exam=await examView(examId,sid);
 if(!exam)throw new ApiError(404,"Exam not found");
 const r=await query<any>(`SELECT st.id student_id,concat_ws(' ',st.first_name,st.last_name) student_name,st.admission_no,st.roll_number,
  COUNT(es.id)::int subject_count,COUNT(em.id)::int marks_entered_count,COALESCE(SUM(es.max_marks),0)::float total_marks,
  COALESCE(SUM(CASE WHEN COALESCE(em.is_absent,false)=false THEN em.marks_obtained ELSE 0 END),0)::float marks_obtained,
  COUNT(em.id) FILTER(WHERE em.pass_status IN ('FAIL','ABSENT'))::int failed_count
  FROM exams e JOIN students st ON st.school_id=e.school_id AND st.class_id=e.class_id AND (e.section_id IS NULL OR st.section_id=e.section_id)
  LEFT JOIN exam_subjects es ON es.exam_id=e.id AND es.is_active=true LEFT JOIN exam_marks em ON em.exam_subject_id=es.id AND em.student_id=st.id
  WHERE e.id=$1 AND e.school_id=$2 AND st.is_active=true GROUP BY st.id ORDER BY marks_obtained DESC,st.first_name`,[examId,sid]);
 const results=r.rows.map((row:any)=>{const total=Number(row.total_marks),obtained=Number(row.marks_obtained);const percentage=total?Math.round(obtained/total*10000)/100:0;
  const passStatus=Number(row.subject_count)===0||Number(row.marks_entered_count)<Number(row.subject_count)?"PENDING":Number(row.failed_count)>0?"FAIL":"PASS";
  return{exam_id:exam.id,exam_name:exam.name,result_status:exam.result_status,student_id:row.student_id,student_name:row.student_name,admission_no:row.admission_no,roll_number:row.roll_number,class_name:exam.class_name,section_name:exam.section_name,subjects:[],total_marks:total,marks_obtained:obtained,percentage,grade:gradeFromPercentage(percentage),pass_status:passStatus,published_at:exam.published_at};});
 const total=results.length,passed=results.filter((item:any)=>item.pass_status==="PASS").length,failed=results.filter((item:any)=>item.pass_status==="FAIL").length;
 res.json({exam,results,summary:{total_students:total,passed,failed,pending:total-passed-failed,average_percentage:total?Math.round(results.reduce((sum:number,item:any)=>sum+item.percentage,0)/total*100)/100:0}});
});
financeRouter.get("/exams/:id/subject-result/:subjectId",async(req,res)=>{
 const examId=Number(req.params.id),subjectId=Number(req.params.subjectId),sid=schoolId(req);const exam=await examView(examId,sid);
 if(!exam)throw new ApiError(404,"Exam not found");
 const examSubject=(await query<any>(`SELECT es.*,su.name subject_name,t.full_name teacher_name,(SELECT COUNT(*)::int FROM exam_marks em WHERE em.exam_subject_id=es.id) marks_entered_count FROM exam_subjects es JOIN subjects su ON su.id=es.subject_id LEFT JOIN teachers t ON t.id=es.teacher_id WHERE es.id=$1 AND es.exam_id=$2 AND es.school_id=$3`,[subjectId,examId,sid])).rows[0];
 if(!examSubject)throw new ApiError(404,"Exam subject not found");
 const marks=(await query<any>(`SELECT em.id,es.id exam_subject_id,st.id student_id,concat_ws(' ',st.first_name,st.last_name) student_name,st.admission_no,st.roll_number,em.marks_obtained,es.max_marks,es.pass_marks,em.grade,COALESCE(em.is_absent,false) is_absent,COALESCE(em.pass_status,'PENDING') pass_status,em.remarks,em.updated_at FROM exams e JOIN exam_subjects es ON es.exam_id=e.id AND es.id=$3 JOIN students st ON st.school_id=e.school_id AND st.class_id=e.class_id AND (e.section_id IS NULL OR st.section_id=e.section_id) LEFT JOIN exam_marks em ON em.exam_subject_id=es.id AND em.student_id=st.id WHERE e.id=$1 AND e.school_id=$2 AND st.is_active=true ORDER BY st.roll_number NULLS LAST,st.first_name`,[examId,sid,subjectId])).rows;
 const total=marks.length,passed=marks.filter((item:any)=>item.pass_status==="PASS").length,failed=marks.filter((item:any)=>["FAIL","ABSENT"].includes(item.pass_status)).length,entered=marks.filter((item:any)=>item.marks_obtained!==null&&item.marks_obtained!==undefined);
 res.json({exam,exam_subject:examSubject,results:marks,summary:{total_students:total,passed,failed,pending:total-passed-failed,average_marks:entered.length?Math.round(entered.reduce((sum:number,item:any)=>sum+Number(item.marks_obtained),0)/entered.length*100)/100:0}});
});
async function personalExam(req:import("express").Request,parent:boolean,cards:boolean){const user=(req as AuthenticatedRequest).user;const join=parent?"JOIN parent_guardians g ON g.user_id=$1 JOIN students st ON st.guardian_id=g.id":"JOIN students st ON st.user_id=$1";if(cards)return (await query(`SELECT e.id exam_id,e.name exam_name,st.id student_id,concat_ws(' ',st.first_name,st.last_name) student_name,e.result_status,COALESCE(SUM(em.marks_obtained),0)::float obtained,COALESCE(SUM(es.max_marks),0)::float maximum FROM exams e ${join} AND st.class_id=e.class_id LEFT JOIN exam_subjects es ON es.exam_id=e.id LEFT JOIN exam_marks em ON em.exam_subject_id=es.id AND em.student_id=st.id WHERE e.school_id=$2 AND e.result_status='PUBLISHED' GROUP BY e.id,st.id ORDER BY e.start_date DESC`,[user.id,schoolId(req)])).rows;return(await query(`SELECT es.*,e.name exam_name,su.name subject_name,st.id student_id,concat_ws(' ',st.first_name,st.last_name) student_name FROM exams e ${join} AND st.class_id=e.class_id JOIN exam_subjects es ON es.exam_id=e.id JOIN subjects su ON su.id=es.subject_id WHERE e.school_id=$2 ORDER BY es.exam_date`,[user.id,schoolId(req)])).rows;}
financeRouter.get("/exams/my-timetable",async(req,res)=>res.json(await personalExam(req,false,false)));financeRouter.get("/exams/my-children-timetable",async(req,res)=>res.json(await personalExam(req,true,false)));financeRouter.get("/exams/my-report-cards",async(req,res)=>res.json(await personalExam(req,false,true)));financeRouter.get("/exams/my-children-report-cards",async(req,res)=>res.json(await personalExam(req,true,true)));

financeRouter.get("/fees/meta",admin,async(req,res)=>{
 const sid=schoolId(req);const currentSessionId=await activeAcademicSessionId(req);
 const [classes,sections,students,categories,structures,sessions]=await Promise.all([
  query("SELECT id,name,code FROM school_classes WHERE school_id=$1 AND is_active=true ORDER BY name",[sid]),
  query("SELECT id,name,class_id FROM sections WHERE school_id=$1 AND is_active=true ORDER BY name",[sid]),
  query("SELECT id,concat_ws(' ',first_name,last_name) name,class_id,section_id,admission_no FROM students WHERE school_id=$1 AND is_active=true ORDER BY first_name LIMIT 1000",[sid]),
  query("SELECT id,name,code FROM fee_categories WHERE school_id=$1 AND is_active=true ORDER BY name",[sid]),
  query("SELECT id,name,amount FROM fee_structures WHERE school_id=$1 AND is_active=true AND ($2::int IS NULL OR academic_session_id=$2 OR academic_session_id IS NULL) ORDER BY name",[sid,currentSessionId]),
  query("SELECT id,name,is_active FROM academic_sessions WHERE school_id=$1 ORDER BY id DESC",[sid]),
 ]);
 res.json({
  classes:classes.rows.map((item:any)=>({id:item.id,name:item.name,extra:item.code??null})),
  sections:sections.rows.map((item:any)=>({id:item.id,name:item.name,extra:String(item.class_id)})),
  students:students.rows.map((item:any)=>({id:item.id,name:item.name,extra:`${item.admission_no} · Class ${item.class_id??"-"}`})),
  categories:categories.rows.map((item:any)=>({id:item.id,name:item.name,extra:item.code??null})),
  structures:structures.rows.map((item:any)=>({id:item.id,name:item.name,extra:`₹${Number(item.amount).toLocaleString("en-IN")}`})),
  academic_sessions:sessions.rows.map((item:any)=>({id:item.id,name:item.name,extra:item.is_active?"Active":null})),
  current_academic_session_id:currentSessionId,
 });
});
const feeResources={categories:{table:"fee_categories",fields:["name","code","description","is_active"]},structures:{table:"fee_structures",fields:["category_id","academic_session_id","name","amount","due_date","description","is_active"]},assignments:{table:"fee_assignments",fields:["fee_structure_id","academic_session_id","class_id","section_id","section_name","student_id","assigned_amount","due_date","note","is_active","generated_at"]},records:{table:"student_fee_records",fields:["student_id","fee_structure_id","fee_assignment_id","academic_session_id","title","amount","discount_amount","fine_amount","paid_amount","balance_amount","due_date","status","note"]},expenses:{table:"fee_expenses",fields:["created_by_user_id","title","category","amount","expense_date","payment_mode","vendor_name","reference_no","note","is_active"]}} as const;
for(const [path,cfg] of Object.entries(feeResources)){
 financeRouter.get(`/fees/${path}`,admin,async(req,res)=>{const values:unknown[]=[schoolId(req)];let where="school_id=$1";for(const f of cfg.fields){if(req.query[f]){values.push(req.query[f]);where+=` AND ${f}=$${values.length}`;}}values.push(Math.min(Number(req.query.limit)||500,1000));res.json((await query(`SELECT * FROM ${cfg.table} WHERE ${where} ORDER BY id DESC LIMIT $${values.length}`,values)).rows);});
 financeRouter.post(`/fees/${path}`,admin,async(req,res)=>{const data:any={...req.body};if(["structures","assignments","records"].includes(path)&&!data.academic_session_id)data.academic_session_id=await activeAcademicSessionId(req);if(path==="records"&&data.balance_amount===undefined)data.balance_amount=Number(data.amount||0)-Number(data.discount_amount||0)+Number(data.fine_amount||0)-Number(data.paid_amount||0);if(path==="expenses")data.created_by_user_id=(req as AuthenticatedRequest).user.id;const cols=cfg.fields.filter(f=>data[f]!==undefined);const r=await query(`INSERT INTO ${cfg.table}(school_id,${cols.join(",")}) VALUES($1,${cols.map((_,i)=>`$${i+2}`).join(",")}) RETURNING *`,[schoolId(req),...cols.map(f=>data[f])]);res.status(201).json(r.rows[0]);});
 financeRouter.put(`/fees/${path}/:id`,admin,async(req,res)=>{const cols=cfg.fields.filter(f=>req.body[f]!==undefined);if(!cols.length)throw new ApiError(422,"No valid fields supplied");const r=await query(`UPDATE ${cfg.table} SET ${cols.map((f,i)=>`${f}=$${i+1}`).join(",")},updated_at=NOW() WHERE id=$${cols.length+1} AND school_id=$${cols.length+2} RETURNING *`,[...cols.map(f=>req.body[f]),Number(req.params.id),schoolId(req)]);if(!r.rows[0])throw new ApiError(404,"Fee record not found");res.json(r.rows[0]);});
 financeRouter.delete(`/fees/${path}/:id`,admin,async(req,res)=>{const r=await query(`DELETE FROM ${cfg.table} WHERE id=$1 AND school_id=$2 RETURNING id`,[Number(req.params.id),schoolId(req)]);if(!r.rowCount)throw new ApiError(404,"Fee record not found");res.json({message:"Deleted successfully"});});
}
financeRouter.post("/fees/assignments/:id/generate-records",admin,async(req,res)=>{const assignment=(await query<any>(`SELECT a.*,s.name structure_name,s.amount structure_amount,s.due_date structure_due_date FROM fee_assignments a JOIN fee_structures s ON s.id=a.fee_structure_id WHERE a.id=$1 AND a.school_id=$2`,[Number(req.params.id),schoolId(req)])).rows[0];if(!assignment)throw new ApiError(404,"Fee assignment not found");const result=await query(`INSERT INTO student_fee_records(school_id,student_id,fee_structure_id,fee_assignment_id,academic_session_id,title,amount,balance_amount,due_date,status)
 SELECT $1,st.id,$2,$3,$4,$5,COALESCE($6,$7),COALESCE($6,$7),COALESCE($8,$9),'PENDING' FROM students st WHERE st.school_id=$1 AND ($10::int IS NULL OR st.id=$10) AND ($11::int IS NULL OR st.class_id=$11) AND ($12::int IS NULL OR st.section_id=$12)
 AND NOT EXISTS(SELECT 1 FROM student_fee_records r WHERE r.student_id=st.id AND r.fee_assignment_id=$3)`,[schoolId(req),assignment.fee_structure_id,assignment.id,assignment.academic_session_id,assignment.structure_name,assignment.assigned_amount,assignment.structure_amount,assignment.due_date,assignment.structure_due_date,assignment.student_id,assignment.class_id,assignment.section_id]);await query("UPDATE fee_assignments SET generated_at=NOW() WHERE id=$1",[assignment.id]);res.json({...assignment,generated_at:new Date(),generated_count:result.rowCount??0});});
financeRouter.get("/fees/payments",admin,async(req,res)=>{const r=await query(`SELECT p.*,concat_ws(' ',s.first_name,s.last_name) student_name,r.title fee_title FROM fee_payments p JOIN students s ON s.id=p.student_id JOIN student_fee_records r ON r.id=p.student_fee_record_id WHERE p.school_id=$1 ORDER BY p.payment_date DESC,p.id DESC LIMIT $2`,[schoolId(req),Math.min(Number(req.query.limit)||500,1000)]);res.json(r.rows);});
financeRouter.post("/fees/payments",admin,async(req,res)=>{const receipt=await transaction(async client=>{const record=(await client.query<any>("SELECT * FROM student_fee_records WHERE id=$1 AND school_id=$2 FOR UPDATE",[req.body.student_fee_record_id,schoolId(req)])).rows[0];if(!record)throw new ApiError(404,"Fee record not found");const amount=Number(req.body.amount);if(amount<=0||amount>Number(record.balance_amount))throw new ApiError(400,"Payment amount is invalid");const receiptNo=req.body.receipt_no??`RCP-${Date.now()}-${randomBytes(2).toString("hex").toUpperCase()}`;const p=await client.query<any>(`INSERT INTO fee_payments(school_id,student_fee_record_id,student_id,collected_by_user_id,receipt_no,amount,payment_date,payment_mode,reference_no,note,razorpay_order_id,razorpay_payment_id,razorpay_signature) VALUES($1,$2,$3,$4,$5,$6,COALESCE($7,CURRENT_DATE),$8,$9,$10,$11,$12,$13) RETURNING *`,[schoolId(req),record.id,record.student_id,(req as AuthenticatedRequest).user.id,receiptNo,amount,req.body.payment_date,req.body.payment_mode??"CASH",req.body.reference_no??null,req.body.note??null,req.body.razorpay_order_id??null,req.body.razorpay_payment_id??null,req.body.razorpay_signature??null]);const paid=Number(record.paid_amount)+amount;const balance=Math.max(0,Number(record.amount)-Number(record.discount_amount)+Number(record.fine_amount)-paid);await client.query("UPDATE student_fee_records SET paid_amount=$1,balance_amount=$2,status=$3,updated_at=NOW() WHERE id=$4",[paid,balance,balance===0?"PAID":"PARTIAL",record.id]);return{payment:p.rows[0],record:{...record,paid_amount:paid,balance_amount:balance,status:balance===0?"PAID":"PARTIAL"}};});res.status(201).json(receipt);});
