import { query } from "../db.js";

export class NotificationService {
  async notify(input: { schoolId: number; createdBy?: number; role?: string; userId?: number; title: string; message: string; category?: string; link?: string }) {
    const result = await query(
      `INSERT INTO in_app_notifications(school_id,created_by,target_role,target_user_id,title,message,category,link)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [input.schoolId, input.createdBy ?? null, input.role ?? null, input.userId ?? null, input.title, input.message, input.category ?? null, input.link ?? null],
    );
    return result.rows[0];
  }

  async markRead(notificationId: number, userId: number) {
    await query("INSERT INTO in_app_notification_reads(notification_id,user_id) VALUES($1,$2) ON CONFLICT(notification_id,user_id) DO NOTHING", [notificationId, userId]);
  }
}

export const notificationService = new NotificationService();
