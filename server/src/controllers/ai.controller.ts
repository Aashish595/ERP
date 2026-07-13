import { randomUUID } from "node:crypto";
import { Router } from "express";
import { allowRoles, requireAuth, schoolId } from "../auth.js";
import { aiService } from "../services/ai.service.js";
import { query } from "../db.js";
import { ApiError } from "../errors.js";
import { config } from "../config.js";
import { sendEmail } from "../services/email.service.js";
import type { AuthenticatedRequest } from "../types.js";

export const aiRouter = Router();
aiRouter.use(requireAuth);

aiRouter.post("/notices/generate", async (req, res) => {
  const text = req.body.description ?? req.body.text ?? req.body.prompt;
  res.json(await aiService.json("/internal/notices/generate", { text, tone: req.body.tone, audience: req.body.audience, language: req.body.language }));
});
aiRouter.post("/notices/enhance", async (req, res) => {
  const text = req.body.content ?? req.body.text;
  res.json(await aiService.json("/internal/notices/enhance", { text, tone: req.body.tone, language: req.body.language }));
});
aiRouter.post("/curriculum/generate", allowRoles("TEACHER", "SCHOOL_ADMIN", "SCHOOL_OWNER", "SUPER_ADMIN"), async (req, res) => {
  const result = await aiService.json("/internal/curriculum/generate", req.body);
  res.json(result);
});
aiRouter.post("/curriculum/approve", allowRoles("TEACHER", "SCHOOL_ADMIN", "SCHOOL_OWNER", "SUPER_ADMIN"), async (req, res) => {
  res.json({ success: true, message: "Curriculum approved", curriculum: req.body });
});

aiRouter.post("/sessions", async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const id = randomUUID();
  const result = await query("INSERT INTO chat_session(id,title,user_id) VALUES($1,$2,$3) RETURNING *", [id, req.body.title ?? "New chat", user.id]);
  res.status(201).json(result.rows[0]);
});
aiRouter.get("/sessions", async (req, res) => {
  const result = await query("SELECT * FROM chat_session WHERE user_id=$1 ORDER BY updated_at DESC", [(req as AuthenticatedRequest).user.id]);
  res.json(result.rows);
});
aiRouter.delete("/sessions/:sessionId", async (req, res) => {
  const result = await query("DELETE FROM chat_session WHERE id=$1 AND user_id=$2 RETURNING id", [req.params.sessionId, (req as AuthenticatedRequest).user.id]);
  if (!result.rowCount) throw new ApiError(404, "Chat session not found");
  res.json({ message: "Chat deleted" });
});
aiRouter.get("/sessions/:sessionId/messages", async (req, res) => {
  const result = await query(
    `SELECT m.* FROM chat_message m JOIN chat_session s ON s.id=m.session_id
     WHERE m.session_id=$1 AND s.user_id=$2 ORDER BY m.created_at`,
    [req.params.sessionId, (req as AuthenticatedRequest).user.id],
  );
  res.json(result.rows);
});
aiRouter.post("/sessions/:sessionId/messages", async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const session = (await query<any>("SELECT * FROM chat_session WHERE id=$1 AND user_id=$2", [req.params.sessionId, user.id])).rows[0];
  if (!session) throw new ApiError(404, "Chat session not found");
  const content = String(req.body.content ?? req.body.message ?? "").trim();
  if (!content) throw new ApiError(422, "Message content is required");
  if (content.length > 30_000) throw new ApiError(422, "Message content is too long");
  await query("INSERT INTO chat_message(role,content,session_id,user_id) VALUES('user',$1,$2,$3)", [content, session.id, user.id]);
  const previous = await query<any>("SELECT role,content FROM chat_message WHERE session_id=$1 ORDER BY created_at DESC LIMIT 20", [session.id]);
  const lesson = req.body.lesson_id ? (await query<any>(
    `SELECT l.id,l.title,l.content,l.transcript FROM lessons l
     JOIN courses c ON c.id=l.course_id WHERE l.id=$1 AND c.school_id=$2`,
    [Number(req.body.lesson_id), schoolId(req)],
  )).rows[0] : null;
  if (req.body.lesson_id && !lesson) throw new ApiError(404, "Lesson not found");
  await query(
    "UPDATE chat_session SET updated_at=NOW(),title=CASE WHEN title='New chat' THEN LEFT($2,80) ELSE title END WHERE id=$1",
    [session.id, content],
  );
  try {
    const answer = await aiService.stream("/internal/chat/stream", {
      messages: previous.rows.reverse(),
      lesson_context: lesson ?? {},
      user_context: { role: user.role, school_id: user.school_id },
    }, res);
    if (answer.trim()) {
      await query("INSERT INTO chat_message(role,content,session_id,user_id) VALUES('assistant',$1,$2,$3)", [answer, session.id, user.id]);
      await query("UPDATE chat_session SET updated_at=NOW() WHERE id=$1", [session.id]);
    }
    res.end();
  } catch (error) {
    if (!res.headersSent) throw error;
    res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : "AI stream failed" })}\n\n`);
    res.end();
  }
});
aiRouter.post("/sessions/share/email", async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const content = String(req.body.content ?? "").trim();
  const to = String(req.body.to_email || user.email || "").trim();
  if (!content || content.length > 30_000) throw new ApiError(422, "Share content is required and must be under 30,000 characters");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new ApiError(422, "A valid recipient email is required");
  const subject = String(req.body.subject || req.body.lesson_title || "Shared learning assistant answer").slice(0, 180);
  await sendEmail({ to, subject, text: content });
  res.json({ ok: true, channel: "email", message: "Answer sent by email" });
});
aiRouter.post("/sessions/share/telegram", async (req, res) => {
  const content = String(req.body.content ?? "").trim();
  const chatId = String(req.body.chat_id || config.TELEGRAM_DEFAULT_CHAT_ID || "").trim();
  if (!content || content.length > 4_000) throw new ApiError(422, "Telegram content is required and must be under 4,000 characters");
  if (!config.TELEGRAM_BOT_TOKEN || !chatId) throw new ApiError(503, "Telegram sharing is not configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: content }),
      signal: controller.signal,
    });
    if (!response.ok) throw new ApiError(502, "Telegram delivery failed");
  } finally {
    clearTimeout(timeout);
  }
  res.json({ ok: true, channel: "telegram", message: "Answer sent to Telegram" });
});

aiRouter.get("/lessons/:lessonId/summary", async (req, res) => {
  const lesson = (await query<any>(
    `SELECT l.* FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.id=$1 AND c.school_id=$2`,
    [Number(req.params.lessonId), schoolId(req)],
  )).rows[0];
  if (!lesson) throw new ApiError(404, "Lesson not found");
  res.json(await aiService.json("/internal/lessons/summary", { title: lesson.title, content: lesson.content ?? "", transcript: lesson.transcript ?? "", language: req.query.language ?? "English" }));
});

async function quiz(req: import("express").Request, res: import("express").Response) {
  const lessonId = Number(req.params.lessonId);
  const lesson = (await query<any>(
    `SELECT l.* FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.id=$1 AND c.id=$2 AND c.school_id=$3`,
    [lessonId, Number(req.params.courseId), schoolId(req)],
  )).rows[0];
  if (!lesson) throw new ApiError(404, "Lesson not found");
  res.json(await aiService.json("/internal/lessons/quiz", {
    title: lesson.title, content: lesson.content ?? "", transcript: lesson.transcript ?? "",
    question_count: req.body.question_count ?? req.body.num_questions ?? 10,
    difficulty: req.body.difficulty ?? "medium", language: req.body.language ?? "English",
  }));
}
aiRouter.post("/lessons/api/course/:courseId/lessons/:lessonId/quiz", quiz);
aiRouter.post("/assignments/api/course/:courseId/lessons/:lessonId/quiz", quiz);
