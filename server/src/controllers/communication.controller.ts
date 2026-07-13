import { Router } from "express";
import { allowRoles, requireAuth, schoolId } from "../auth.js";
import { query, transaction } from "../db.js";
import { ApiError } from "../errors.js";
import type { AuthenticatedRequest } from "../types.js";

export const communicationRouter = Router();
communicationRouter.use(requireAuth);
const staff = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN", "TEACHER");
const admins = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN");
const adminRoles = new Set(["SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN"]);

const configs = {
  announcements: { table: "communication_announcements", fields: ["title", "message", "priority", "status", "audience_roles", "start_at", "end_at"] },
  events: { table: "communication_events", fields: ["title", "description", "event_date", "end_date", "start_time", "end_time", "location", "category", "status", "audience_roles"] },
  complaints: { table: "complaints", fields: ["assigned_to", "subject", "description", "category", "priority", "status", "action_taken", "is_anonymous"] },
} as const;

function isAdmin(req: import("express").Request) {
  return adminRoles.has((req as AuthenticatedRequest).user.role);
}

function audienceCsv(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(",") || null;
  return String(value).replace(/^\{|\}$/g, "").replaceAll('"', "") || null;
}

function audienceList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value ?? "").replace(/^\{|\}$/g, "").replaceAll('"', "").split(",").map((role) => role.trim()).filter(Boolean);
}

function page(req: import("express").Request, defaultLimit = 50, maxLimit = 200) {
  const skip = Math.max(0, Number(req.query.skip) || 0);
  const limit = Math.min(maxLimit, Math.max(1, Number(req.query.limit) || defaultLimit));
  return { skip, limit };
}

function communicationRow(row: any) {
  const result = { ...row };
  if ("audience_roles" in result) result.audience_roles = audienceList(result.audience_roles);
  if (result.author_id != null) result.author = { id: result.author_id, full_name: result.author_name, role: result.author_role };
  else result.author = null;
  if (result.creator_id != null) result.creator = { id: result.creator_id, full_name: result.creator_name, role: result.creator_role };
  else if ("creator_id" in result) result.creator = null;
  if (result.assignee_id != null) result.assignee = { id: result.assignee_id, full_name: result.assignee_name, role: result.assignee_role };
  else if ("assignee_id" in result) result.assignee = null;
  for (const key of ["author_id", "author_name", "author_role", "creator_id", "creator_name", "creator_role", "assignee_id", "assignee_name", "assignee_role"]) delete result[key];
  return result;
}

function audienceWhere(column: string, parameter: number) {
  return `(${column} IS NULL OR ${column}='' OR (',' || ${column} || ',') LIKE '%,' || $${parameter} || ',%')`;
}

async function loadCommunicationRow(table: string, id: number, req: import("express").Request) {
  const result = await query<any>(`SELECT x.*,u.id author_id,u.full_name author_name,u.role author_role
    FROM ${table} x LEFT JOIN users u ON u.id=x.created_by WHERE x.id=$1 AND x.school_id=$2`, [id, schoolId(req)]);
  if (!result.rows[0]) throw new ApiError(404, "Record not found");
  return communicationRow(result.rows[0]);
}

async function broadcastNotification(client: { query: typeof query }, data: {
  schoolId: number; title: string; message: string; category: string; priority?: string; roles: string[]; createdBy: number; link?: string;
}) {
  const roles = data.roles.length ? data.roles : [null];
  for (const role of roles) {
    await client.query(`INSERT INTO in_app_notifications(school_id,created_by,target_role,title,message,category,priority,link)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [data.schoolId, data.createdBy, role, data.title, data.message, data.category, data.priority ?? "NORMAL", data.link ?? "/communication"]);
  }
}

for (const kind of ["announcements", "events"] as const) {
  const cfg = configs[kind];
  communicationRouter.get(`/${kind}`, async (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    const { skip, limit } = page(req);
    const values: unknown[] = [schoolId(req)];
    let where = "x.school_id=$1";
    if (req.query.status) { values.push(String(req.query.status)); where += ` AND x.status=$${values.length}`; }
    else if (!isAdmin(req)) { values.push("PUBLISHED"); where += ` AND x.status=$${values.length}`; }
    if (kind === "events" && req.query.from_date) { values.push(String(req.query.from_date)); where += ` AND x.event_date>=$${values.length}`; }
    if (!isAdmin(req)) { values.push(user.role); where += ` AND ${audienceWhere("x.audience_roles", values.length)}`; }
    values.push(limit, skip);
    const order = kind === "events" ? "x.event_date ASC,x.start_time ASC" : "x.created_at DESC";
    const result = await query<any>(`SELECT x.*,u.id author_id,u.full_name author_name,u.role author_role
      FROM ${cfg.table} x LEFT JOIN users u ON u.id=x.created_by WHERE ${where} ORDER BY ${order} LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
    res.json(result.rows.map(communicationRow));
  });

  communicationRouter.post(`/${kind}`, admins, async (req, res) => {
    const data = Object.fromEntries(Object.entries(req.body).filter(([key, value]) => (cfg.fields as readonly string[]).includes(key) && value !== undefined));
    if ("audience_roles" in data) data.audience_roles = audienceCsv(data.audience_roles);
    const columns = Object.keys(data); const values = Object.values(data);
    const user = (req as AuthenticatedRequest).user;
    const created = await transaction(async (client) => {
      const result = await client.query<any>(`INSERT INTO ${cfg.table}(school_id,created_by,${columns.join(",")}) VALUES($1,$2,${columns.map((_,i)=>`$${i+3}`).join(",")}) RETURNING *`, [schoolId(req), user.id, ...values]);
      const item = result.rows[0];
      if (item.status === "PUBLISHED") await broadcastNotification(client, {
        schoolId: schoolId(req), createdBy: user.id, roles: audienceList(item.audience_roles),
        title: kind === "events" ? `Event: ${item.title}` : item.title,
        message: String(item.description ?? item.message ?? item.title).slice(0, 250),
        category: kind === "events" ? (String(item.category ?? "").toUpperCase() === "MEETING" ? "MEETING" : "EVENT") : "ANNOUNCEMENT",
        priority: kind === "announcements" ? item.priority : "NORMAL",
      });
      return item;
    });
    res.status(201).json(await loadCommunicationRow(cfg.table, created.id, req));
  });

  communicationRouter.patch(`/${kind}/:id`, admins, async (req, res) => {
    const data = Object.fromEntries(Object.entries(req.body).filter(([key, value]) => (cfg.fields as readonly string[]).includes(key) && value !== undefined));
    if ("audience_roles" in data) data.audience_roles = audienceCsv(data.audience_roles);
    const columns = Object.keys(data); const values = Object.values(data);
    if (!columns.length) throw new ApiError(422, "No valid fields supplied");
    const result = await query(`UPDATE ${cfg.table} SET ${columns.map((key,i)=>`${key}=$${i+1}`).join(",")},updated_at=NOW() WHERE id=$${columns.length+1} AND school_id=$${columns.length+2} RETURNING id`, [...values, Number(req.params.id), schoolId(req)]);
    if (!result.rows[0]) throw new ApiError(404, "Record not found");
    res.json(await loadCommunicationRow(cfg.table, Number(req.params.id), req));
  });

  communicationRouter.delete(`/${kind}/:id`, admins, async (req, res) => {
    const result = await query(`DELETE FROM ${cfg.table} WHERE id=$1 AND school_id=$2 RETURNING id`, [Number(req.params.id), schoolId(req)]);
    if (!result.rowCount) throw new ApiError(404, "Record not found");
    res.json({ message: `${kind === "events" ? "Event" : "Announcement"} deleted successfully` });
  });
}

communicationRouter.post("/complaints", async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const item = await transaction(async (client) => {
    const result = await client.query<any>(`INSERT INTO complaints(school_id,created_by,subject,description,category,priority,status,is_anonymous)
      VALUES($1,$2,$3,$4,$5,$6,'SUBMITTED',$7) RETURNING *`, [schoolId(req), user.id, req.body.subject, req.body.description, req.body.category ?? null, req.body.priority ?? "NORMAL", Boolean(req.body.is_anonymous)]);
    for (const targetRole of ["SCHOOL_OWNER", "SCHOOL_ADMIN"]) await client.query(`INSERT INTO in_app_notifications(school_id,created_by,target_role,title,message,category,priority,link)
      VALUES($1,$2,$3,'New complaint submitted',$4,'COMPLAINT','HIGH','/communication')`, [schoolId(req), req.body.is_anonymous ? null : user.id, targetRole, req.body.subject]);
    return result.rows[0];
  });
  res.status(201).json({ ...item, creator: item.is_anonymous && !isAdmin(req) ? null : { id: user.id, full_name: user.full_name, role: user.role }, assignee: null });
});

communicationRouter.get("/complaints", async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const { skip, limit } = page(req);
  const values: unknown[] = [schoolId(req)];
  let where = "c.school_id=$1";
  if (!isAdmin(req)) { values.push(user.id); where += ` AND c.created_by=$${values.length}`; }
  if (req.query.status) { values.push(String(req.query.status)); where += ` AND c.status=$${values.length}`; }
  values.push(limit, skip);
  const result = await query<any>(`SELECT c.*,creator.id creator_id,creator.full_name creator_name,creator.role creator_role,
    assignee.id assignee_id,assignee.full_name assignee_name,assignee.role assignee_role FROM complaints c
    LEFT JOIN users creator ON creator.id=c.created_by LEFT JOIN users assignee ON assignee.id=c.assigned_to
    WHERE ${where} ORDER BY c.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  res.json(result.rows.map((row) => {
    const mapped = communicationRow(row);
    if (mapped.is_anonymous && !isAdmin(req)) mapped.creator = null;
    return mapped;
  }));
});

communicationRouter.patch("/complaints/:id", async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const existing = (await query<any>("SELECT * FROM complaints WHERE id=$1 AND school_id=$2", [Number(req.params.id), schoolId(req)])).rows[0];
  if (!existing) throw new ApiError(404, "Complaint not found");
  if (!isAdmin(req) && existing.created_by !== user.id) throw new ApiError(403, "You can update only your own complaints");
  if (!isAdmin(req) && !["SUBMITTED", "UNDER_REVIEW"].includes(existing.status)) throw new ApiError(400, "Closed/resolved complaints cannot be edited by requester");
  const allowed = isAdmin(req) ? configs.complaints.fields : ["subject", "description", "category", "priority", "is_anonymous"];
  const data = Object.fromEntries(Object.entries(req.body).filter(([key, value]) => allowed.includes(key as never) && value !== undefined));
  if (isAdmin(req) && data.status && ["RESOLVED", "REJECTED", "CLOSED"].includes(String(data.status)) && data.status !== existing.status) data.resolved_at = new Date();
  const columns = Object.keys(data);
  if (!columns.length) throw new ApiError(422, "No valid fields supplied");
  const updated = await transaction(async (client) => {
    const result = await client.query<any>(`UPDATE complaints SET ${columns.map((key, index) => `${key}=$${index + 1}`).join(",")},updated_at=NOW()
      WHERE id=$${columns.length + 1} AND school_id=$${columns.length + 2} RETURNING *`, [...Object.values(data), Number(req.params.id), schoolId(req)]);
    const item = result.rows[0];
    if (item.created_by && item.status !== existing.status && ["RESOLVED", "REJECTED", "CLOSED"].includes(item.status)) await client.query(`INSERT INTO in_app_notifications(school_id,created_by,target_user_id,title,message,category,priority,link)
      VALUES($1,$2,$3,'Complaint status updated',$4,'COMPLAINT','NORMAL','/communication')`, [schoolId(req), user.id, item.created_by, `Your complaint '${item.subject}' is now ${String(item.status).replaceAll("_", " ").toLowerCase()}.`]);
    return item;
  });
  const users = await query<any>("SELECT id,full_name,role FROM users WHERE id=ANY($1::int[])", [[updated.created_by, updated.assigned_to].filter(Boolean)]);
  const byId = new Map(users.rows.map((item) => [item.id, item]));
  res.json({ ...updated, creator: updated.is_anonymous && !isAdmin(req) ? null : byId.get(updated.created_by) ?? null, assignee: byId.get(updated.assigned_to) ?? null });
});

communicationRouter.post("/notifications", admins, async (req, res) => {
  const fields = ["target_role", "target_user_id", "title", "message", "category", "priority", "link", "expires_at"];
  const data = Object.fromEntries(Object.entries(req.body).filter(([key,value])=>fields.includes(key)&&value!==undefined));
  const columns=Object.keys(data); const values=Object.values(data);
  const result=await query(`INSERT INTO in_app_notifications(school_id,created_by,${columns.join(",")}) VALUES($1,$2,${columns.map((_,i)=>`$${i+3}`).join(",")}) RETURNING *`,[schoolId(req),(req as AuthenticatedRequest).user.id,...values]);
  res.status(201).json({ ...result.rows[0], is_read: false, author: { id: (req as AuthenticatedRequest).user.id, full_name: (req as AuthenticatedRequest).user.full_name, role: (req as AuthenticatedRequest).user.role } });
});

async function visibleNotifications(req: import("express").Request, countOnly=false) {
  const user=(req as AuthenticatedRequest).user;
  const select=countOnly?"COUNT(*)::int AS count":"n.*, (r.id IS NOT NULL) AS is_read,u.id author_id,u.full_name author_name,u.role author_role";
  const result=await query<any>(
    `SELECT ${select} FROM in_app_notifications n LEFT JOIN in_app_notification_reads r ON r.notification_id=n.id AND r.user_id=$1
     ${countOnly ? "" : "LEFT JOIN users u ON u.id=n.created_by"}
     WHERE n.school_id=$2 AND (n.target_user_id IS NULL OR n.target_user_id=$1) AND (n.target_role IS NULL OR n.target_role=$3)
       AND (n.expires_at IS NULL OR n.expires_at>NOW()) ${countOnly?"AND r.id IS NULL":"ORDER BY n.created_at DESC"}`,
    [user.id,schoolId(req),user.role],
  );
  return countOnly?(result.rows[0]??{count:0}):result.rows.map(communicationRow);
}
communicationRouter.get("/notifications/unread-count",async(req,res)=>res.json(await visibleNotifications(req,true)));
communicationRouter.get("/notifications",async(req,res)=>{
  const { skip, limit } = page(req, 30, 100);
  const items = await visibleNotifications(req) as any[];
  const filtered = String(req.query.unread_only ?? "false") === "true" ? items.filter((item) => !item.is_read) : items;
  res.json(filtered.slice(skip, skip + limit));
});
communicationRouter.post("/notifications/read-all",async(req,res)=>{
  const user=(req as AuthenticatedRequest).user;
  await query(`INSERT INTO in_app_notification_reads(notification_id,user_id)
    SELECT n.id,$1 FROM in_app_notifications n WHERE n.school_id=$2 AND (n.target_user_id IS NULL OR n.target_user_id=$1)
      AND (n.target_role IS NULL OR n.target_role=$3) AND (n.expires_at IS NULL OR n.expires_at>NOW())
    ON CONFLICT(notification_id,user_id) DO NOTHING`,[user.id,schoolId(req),user.role]);
  res.json({message:"All notifications marked as read"});
});
communicationRouter.post("/notifications/:id/read",async(req,res)=>{
  const user=(req as AuthenticatedRequest).user;
  const visible=await query(`SELECT id FROM in_app_notifications WHERE id=$1 AND school_id=$2 AND (target_user_id IS NULL OR target_user_id=$3)
    AND (target_role IS NULL OR target_role=$4) AND (expires_at IS NULL OR expires_at>NOW())`,[Number(req.params.id),schoolId(req),user.id,user.role]);
  if(!visible.rowCount)throw new ApiError(404,"Notification not found");
  await query("INSERT INTO in_app_notification_reads(notification_id,user_id) VALUES($1,$2) ON CONFLICT(notification_id,user_id) DO NOTHING",[Number(req.params.id),user.id]);
  res.json({message:"Notification marked as read"});
});
communicationRouter.get("/overview",async(req,res)=>{
  const user=(req as AuthenticatedRequest).user;
  const sid=schoolId(req);
  const admin=isAdmin(req);
  const result=await query<any>(`SELECT
    (SELECT COUNT(*)::int FROM communication_announcements WHERE school_id=$1 AND ($4::boolean OR (status='PUBLISHED' AND ${audienceWhere("audience_roles", 2)}))) announcements,
    (SELECT COUNT(*)::int FROM communication_events WHERE school_id=$1 AND event_date>=CURRENT_DATE AND ($4::boolean OR (status='PUBLISHED' AND ${audienceWhere("audience_roles", 2)}))) upcoming_events,
    (SELECT COUNT(*)::int FROM complaints WHERE school_id=$1 AND status IN ('SUBMITTED','UNDER_REVIEW') AND ($4::boolean OR created_by=$3)) open_complaints`,[sid,user.role,user.id,admin]);
  const unread=await visibleNotifications(req,true) as {count:number};
  res.json({...result.rows[0],unread_notifications:unread.count});
});

export const noticesRouter=Router();
noticesRouter.use(requireAuth);
noticesRouter.post("/",staff,async(req,res)=>{
  const user=(req as AuthenticatedRequest).user;
  const row=await transaction(async client=>{
    const result=await client.query<any>(`INSERT INTO notices(school_id,created_by,title,content,priority,status,is_pinned,publish_at,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[schoolId(req),user.id,req.body.title,req.body.content,req.body.priority??"NORMAL",req.body.status??"PUBLISHED",Boolean(req.body.is_pinned),req.body.publish_at??null,req.body.expires_at??null]);
    const notice=result.rows[0];
    for(const role of req.body.audience_roles??[]) await client.query("INSERT INTO notice_audiences(notice_id,role) VALUES($1,$2)",[notice.id,role]);
    for(const target of req.body.class_audiences??[]) await client.query("INSERT INTO notice_class_audiences(notice_id,class_id,section_id,section_name) VALUES($1,$2,$3,$4)",[notice.id,target.class_id,target.section_id??null,target.section_name??null]);
    return notice;
  });
  res.status(201).json(row);
});
noticesRouter.get("/",async(req,res)=>{
  const user=(req as AuthenticatedRequest).user;
  const params:unknown[]=[schoolId(req),user.id,user.role];
  const result=await query<any>(`SELECT n.*,u.full_name AS created_by_name,(nr.id IS NOT NULL) AS is_read,
    COALESCE((SELECT json_agg(na.role) FROM notice_audiences na WHERE na.notice_id=n.id),'[]') AS audience_roles
    FROM notices n JOIN users u ON u.id=n.created_by LEFT JOIN notice_reads nr ON nr.notice_id=n.id AND nr.user_id=$2
    WHERE n.school_id=$1 AND (n.status='PUBLISHED' OR n.created_by=$2) AND (n.expires_at IS NULL OR n.expires_at>NOW())
    AND (NOT EXISTS(SELECT 1 FROM notice_audiences x WHERE x.notice_id=n.id) OR EXISTS(SELECT 1 FROM notice_audiences x WHERE x.notice_id=n.id AND x.role=$3))
    ORDER BY n.is_pinned DESC,n.created_at DESC LIMIT 200`,params);
  res.json({items:result.rows,total:result.rowCount??0});
});
noticesRouter.get("/:id",async(req,res)=>{
  const row=(await query("SELECT * FROM notices WHERE id=$1 AND school_id=$2",[Number(req.params.id),schoolId(req)])).rows[0];
  if(!row)throw new ApiError(404,"Notice not found"); res.json(row);
});
noticesRouter.patch("/:id",staff,async(req,res)=>{
  const allowed=["title","content","priority","status","is_pinned","publish_at","expires_at"];
  const data=Object.fromEntries(Object.entries(req.body).filter(([k,v])=>allowed.includes(k)&&v!==undefined)); const cols=Object.keys(data);
  const result=await query(`UPDATE notices SET ${cols.map((k,i)=>`${k}=$${i+1}`).join(",")},updated_at=NOW() WHERE id=$${cols.length+1} AND school_id=$${cols.length+2} RETURNING *`,[...Object.values(data),Number(req.params.id),schoolId(req)]);
  if(!result.rows[0])throw new ApiError(404,"Notice not found");res.json(result.rows[0]);
});
noticesRouter.patch("/:id/pin",staff,async(req,res)=>{
  const result=await query("UPDATE notices SET is_pinned=COALESCE($1,NOT is_pinned),pinned_by=$2,updated_at=NOW() WHERE id=$3 AND school_id=$4 RETURNING *",[req.body.is_pinned,(req as AuthenticatedRequest).user.id,Number(req.params.id),schoolId(req)]);
  if(!result.rows[0])throw new ApiError(404,"Notice not found");res.json(result.rows[0]);
});
noticesRouter.post("/:id/read",async(req,res)=>{await query("INSERT INTO notice_reads(notice_id,user_id) VALUES($1,$2) ON CONFLICT(notice_id,user_id) DO NOTHING",[Number(req.params.id),(req as AuthenticatedRequest).user.id]);res.json({message:"Notice marked as read"});});
noticesRouter.delete("/:id",staff,async(req,res)=>{const result=await query("DELETE FROM notices WHERE id=$1 AND school_id=$2 RETURNING id",[Number(req.params.id),schoolId(req)]);if(!result.rowCount)throw new ApiError(404,"Notice not found");res.status(204).end();});
