import { randomBytes } from "node:crypto";
import { Router } from "express";
import type pg from "pg";
import { requireAuth, schoolId } from "../auth.js";
import { config } from "../config.js";
import { query, transaction } from "../db.js";
import { ApiError } from "../errors.js";
import { paymentService } from "../services/payment.service.js";
import type { AuthenticatedRequest } from "../types.js";

type FeeRecord = {
  id: number;
  school_id: number;
  student_id: number;
  title: string;
  amount: number;
  discount_amount: number;
  fine_amount: number;
  paid_amount: number;
  balance_amount: number;
  status: string;
  student_name: string;
  admission_no: string;
  email?: string | null;
  phone?: string | null;
};

type PaymentOrder = {
  razorpay_order_id: string;
  student_fee_record_id: number;
  student_id: number;
  school_id: number;
  created_by_user_id: number | null;
  amount_paise: number;
  currency: string;
  status: string;
};

export const feesRouter = Router();

function isManager(role: string) {
  return ["SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN"].includes(role);
}

async function authorizedRecord(req: import("express").Request, recordId: number): Promise<FeeRecord> {
  const user = (req as AuthenticatedRequest).user;
  const result = await query<FeeRecord>(
    `SELECT r.*,concat_ws(' ',s.first_name,s.last_name) student_name,s.admission_no,s.email,s.phone
     FROM student_fee_records r JOIN students s ON s.id=r.student_id
     WHERE r.id=$1 AND r.school_id=$2`,
    [recordId, schoolId(req)],
  );
  const record = result.rows[0];
  if (!record) throw new ApiError(404, "Fee record not found");
  if (isManager(user.role)) return record;
  if (!['STUDENT', 'PARENT'].includes(user.role)) throw new ApiError(403, "You do not have permission to pay this fee");
  const allowed = user.role === "STUDENT"
    ? await query("SELECT id FROM students WHERE id=$1 AND user_id=$2 AND school_id=$3", [record.student_id, user.id, schoolId(req)])
    : await query(
      `SELECT s.id FROM parent_guardians g JOIN students s ON s.guardian_id=g.id
       WHERE s.id=$1 AND g.user_id=$2 AND s.school_id=$3`,
      [record.student_id, user.id, schoolId(req)],
    );
  if (!allowed.rowCount) throw new ApiError(403, "You do not have permission to pay this fee record");
  return record;
}

async function loadReceipt(client: pg.PoolClient | null, school: number, paymentId: number) {
  const execute = <T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[]) =>
    client ? client.query<T>(text, values) : query<T>(text, values);
  const payment = (await execute(
    `SELECT p.*,concat_ws(' ',s.first_name,s.last_name) student_name,s.admission_no,
            r.title fee_title,u.full_name collected_by_name
     FROM fee_payments p
     JOIN students s ON s.id=p.student_id
     JOIN student_fee_records r ON r.id=p.student_fee_record_id
     LEFT JOIN users u ON u.id=p.collected_by_user_id
     WHERE p.id=$1 AND p.school_id=$2`,
    [paymentId, school],
  )).rows[0];
  if (!payment) throw new ApiError(404, "Receipt not found");
  const record = (await execute(
    `SELECT r.*,concat_ws(' ',s.first_name,s.last_name) student_name,s.admission_no,
            c.name class_name,COALESCE(sec.name,r.section_name) section_name,
            fs.name fee_structure_name,fc.id category_id,fc.name category_name,
            CASE WHEN r.fee_structure_id IS NULL THEN 'MISCELLANEOUS' ELSE 'STRUCTURED' END fee_type,
            a.name academic_session_name
     FROM student_fee_records r
     JOIN students s ON s.id=r.student_id
     LEFT JOIN school_classes c ON c.id=s.class_id
     LEFT JOIN sections sec ON sec.id=s.section_id
     LEFT JOIN fee_structures fs ON fs.id=r.fee_structure_id
     LEFT JOIN fee_categories fc ON fc.id=fs.category_id
     LEFT JOIN academic_sessions a ON a.id=r.academic_session_id
     WHERE r.id=$1 AND r.school_id=$2`,
    [payment.student_fee_record_id, school],
  )).rows[0];
  if (!record) throw new ApiError(404, "Fee record for this receipt was not found");
  const schoolRow = (await execute("SELECT name,school_code FROM schools WHERE id=$1", [school])).rows[0];
  return {
    payment,
    record,
    school_name: schoolRow?.name ?? null,
    school_code: schoolRow?.school_code ?? null,
  };
}

async function finalizeCapturedPayment(input: {
  orderId: string;
  paymentId: string;
  amountPaise: number;
  currency: string;
  signature?: string | null;
  expectedSchoolId?: number;
}) {
  return transaction(async (client) => {
    const order = (await client.query<PaymentOrder>(
      `SELECT * FROM fee_payment_orders WHERE razorpay_order_id=$1 FOR UPDATE`,
      [input.orderId],
    )).rows[0];
    if (!order || (input.expectedSchoolId && order.school_id !== input.expectedSchoolId)) {
      throw new ApiError(404, "Payment order not found");
    }
    if (order.amount_paise !== input.amountPaise || order.currency !== input.currency) {
      throw new ApiError(400, "Payment amount or currency does not match the server order");
    }

    const existing = (await client.query<{ id: number }>(
      "SELECT id FROM fee_payments WHERE razorpay_payment_id=$1 AND school_id=$2",
      [input.paymentId, order.school_id],
    )).rows[0];
    if (existing) return loadReceipt(client, order.school_id, existing.id);
    if (order.status === "PAID") {
      const paidOrder = (await client.query<{ id: number }>(
        "SELECT id FROM fee_payments WHERE razorpay_order_id=$1 AND school_id=$2 LIMIT 1",
        [order.razorpay_order_id, order.school_id],
      )).rows[0];
      if (paidOrder) return loadReceipt(client, order.school_id, paidOrder.id);
      throw new ApiError(409, "Payment order is marked paid but its receipt is unavailable; manual review is required");
    }

    const record = (await client.query<FeeRecord>(
      "SELECT * FROM student_fee_records WHERE id=$1 AND school_id=$2 FOR UPDATE",
      [order.student_fee_record_id, order.school_id],
    )).rows[0];
    if (!record) throw new ApiError(404, "Fee record not found");
    const amount = input.amountPaise / 100;
    if (amount <= 0 || amount > Number(record.balance_amount)) {
      await client.query(
        "UPDATE fee_payment_orders SET status='REVIEW_REQUIRED',razorpay_payment_id=$1,updated_at=NOW() WHERE razorpay_order_id=$2",
        [input.paymentId, order.razorpay_order_id],
      );
      throw new ApiError(409, "Payment no longer matches the pending fee balance; manual review is required");
    }

    const receiptNo = `RCP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO fee_payments(
         school_id,student_fee_record_id,student_id,collected_by_user_id,receipt_no,amount,payment_date,
         payment_mode,reference_no,razorpay_order_id,razorpay_payment_id,razorpay_signature
       ) VALUES($1,$2,$3,$4,$5,$6,CURRENT_DATE,'ONLINE',$7,$8,$7,$9) RETURNING id`,
      [order.school_id, record.id, record.student_id, order.created_by_user_id, receiptNo, amount,
        input.paymentId, order.razorpay_order_id, input.signature ?? null],
    );
    const paid = Number(record.paid_amount) + amount;
    const balance = Math.max(0, Number(record.amount) - Number(record.discount_amount) + Number(record.fine_amount) - paid);
    await client.query(
      `UPDATE student_fee_records
       SET paid_amount=$1,balance_amount=$2,status=CASE WHEN $2=0 THEN 'PAID' ELSE 'PARTIAL' END,updated_at=NOW()
       WHERE id=$3`,
      [paid, balance, record.id],
    );
    await client.query(
      `UPDATE fee_payment_orders
       SET status='PAID',razorpay_payment_id=$1,paid_at=NOW(),updated_at=NOW()
       WHERE razorpay_order_id=$2`,
      [input.paymentId, order.razorpay_order_id],
    );
    return loadReceipt(client, order.school_id, inserted.rows[0]!.id);
  });
}

feesRouter.post("/fees/razorpay/webhook", async (req, res) => {
  paymentService.verifyWebhookSignature(
    (req as AuthenticatedRequest).rawBody,
    req.header("x-razorpay-signature") || undefined,
  );
  const event = String(req.body?.event || "");
  if (event !== "payment.captured") return res.json({ received: true, ignored: true });
  const payment = req.body?.payload?.payment?.entity;
  if (!payment?.id || !payment?.order_id) throw new ApiError(400, "Webhook payment payload is invalid");
  try {
    await finalizeCapturedPayment({
      orderId: String(payment.order_id),
      paymentId: String(payment.id),
      amountPaise: Number(payment.amount),
      currency: String(payment.currency),
    });
    res.json({ received: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return res.json({ received: true, ignored: true });
    throw error;
  }
});

feesRouter.use(requireAuth);

feesRouter.get("/fees/portal", async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  if (!['STUDENT', 'PARENT'].includes(user.role)) throw new ApiError(403, "The fee portal is available to students and parents");
  const scope = user.role === "PARENT"
    ? "JOIN parent_guardians g ON g.id=s.guardian_id AND g.user_id=$1"
    : "";
  const userWhere = user.role === "STUDENT" ? "s.user_id=$1" : "TRUE";
  const records = (await query(
    `SELECT r.*,concat_ws(' ',s.first_name,s.last_name) student_name,s.admission_no,
            c.name class_name,COALESCE(sec.name,r.section_name) section_name,
            fs.name fee_structure_name,fc.id category_id,fc.name category_name,
            CASE WHEN r.fee_structure_id IS NULL THEN 'MISCELLANEOUS' ELSE 'STRUCTURED' END fee_type,
            a.name academic_session_name
     FROM students s ${scope}
     JOIN student_fee_records r ON r.student_id=s.id
     LEFT JOIN school_classes c ON c.id=s.class_id
     LEFT JOIN sections sec ON sec.id=s.section_id
     LEFT JOIN fee_structures fs ON fs.id=r.fee_structure_id
     LEFT JOIN fee_categories fc ON fc.id=fs.category_id
     LEFT JOIN academic_sessions a ON a.id=r.academic_session_id
     WHERE ${userWhere} AND s.school_id=$2 AND r.school_id=$2 ORDER BY r.due_date,r.id`,
    [user.id, schoolId(req)],
  )).rows as any[];
  const payments = (await query(
    `SELECT p.*,concat_ws(' ',s.first_name,s.last_name) student_name,s.admission_no,r.title fee_title
     FROM fee_payments p JOIN students s ON s.id=p.student_id ${scope}
     JOIN student_fee_records r ON r.id=p.student_fee_record_id
     WHERE ${userWhere} AND p.school_id=$2 ORDER BY p.payment_date DESC,p.id DESC LIMIT 100`,
    [user.id, schoolId(req)],
  )).rows;
  const totalBillable = records.reduce((sum, row) => sum + Number(row.amount) + Number(row.fine_amount) - Number(row.discount_amount), 0);
  const totalPaid = records.reduce((sum, row) => sum + Number(row.paid_amount), 0);
  const totalPending = records.reduce((sum, row) => sum + Number(row.balance_amount), 0);
  res.json({
    role: user.role,
    summary: {
      total_records: records.length,
      pending_records: records.filter((row) => row.status === "PENDING").length,
      partial_records: records.filter((row) => row.status === "PARTIAL").length,
      paid_records: records.filter((row) => row.status === "PAID").length,
      overdue_records: records.filter((row) => row.status === "OVERDUE").length,
      total_billable: totalBillable,
      total_paid: totalPaid,
      total_pending: totalPending,
      today_collection: 0,
      month_collection: 0,
      month_expense: 0,
      net_month_collection: 0,
    },
    records,
    payments,
  });
});

feesRouter.get("/fees/dashboard", async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  if (!isManager(user.role)) throw new ApiError(403, "You do not have permission to view fee reports");
  const result = await query<any>(
    `SELECT COUNT(*)::int total_records,
            COUNT(*) FILTER(WHERE status='PENDING')::int pending_records,
            COUNT(*) FILTER(WHERE status='PARTIAL')::int partial_records,
            COUNT(*) FILTER(WHERE status='PAID')::int paid_records,
            COUNT(*) FILTER(WHERE status='OVERDUE')::int overdue_records,
            COALESCE(SUM(amount+fine_amount-discount_amount),0)::float total_billable,
            COALESCE(SUM(paid_amount),0)::float total_paid,
            COALESCE(SUM(balance_amount),0)::float total_pending,
            (SELECT COALESCE(SUM(amount),0)::float FROM fee_payments WHERE school_id=$1 AND payment_date=CURRENT_DATE) today_collection,
            (SELECT COALESCE(SUM(amount),0)::float FROM fee_payments WHERE school_id=$1 AND date_trunc('month',payment_date)=date_trunc('month',CURRENT_DATE)) month_collection,
            (SELECT COALESCE(SUM(amount),0)::float FROM fee_expenses WHERE school_id=$1 AND is_active=true AND date_trunc('month',expense_date)=date_trunc('month',CURRENT_DATE)) month_expense
     FROM student_fee_records WHERE school_id=$1`,
    [schoolId(req)],
  );
  const row = result.rows[0];
  res.json({ ...row, net_month_collection: Number(row.month_collection) - Number(row.month_expense) });
});

feesRouter.get("/fees/daily-collection", async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  if (!isManager(user.role)) throw new ApiError(403, "You do not have permission to view fee reports");
  const reportDate = String(req.query.report_date || new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) throw new ApiError(400, "Invalid report date");
  const payments = (await query(
    `SELECT p.*,concat_ws(' ',s.first_name,s.last_name) student_name,s.admission_no,r.title fee_title
     FROM fee_payments p JOIN students s ON s.id=p.student_id JOIN student_fee_records r ON r.id=p.student_fee_record_id
     WHERE p.school_id=$1 AND p.payment_date=$2 ORDER BY p.id DESC`,
    [schoolId(req), reportDate],
  )).rows as any[];
  const paymentModeSummary: Record<string, number> = {};
  for (const payment of payments) paymentModeSummary[payment.payment_mode] = (paymentModeSummary[payment.payment_mode] || 0) + Number(payment.amount);
  res.json({
    report_date: reportDate,
    total_collection: payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
    total_payments: payments.length,
    payment_mode_summary: paymentModeSummary,
    payments,
  });
});

feesRouter.get("/fees/receipts/:id", async (req, res) => {
  const paymentId = Number(req.params.id);
  if (!Number.isInteger(paymentId)) throw new ApiError(400, "Invalid receipt id");
  const receipt = await loadReceipt(null, schoolId(req), paymentId);
  const user = (req as AuthenticatedRequest).user;
  if (!isManager(user.role)) await authorizedRecord(req, receipt.record.id);
  res.json(receipt);
});

feesRouter.post("/fees/razorpay/create-order", async (req, res) => {
  const recordId = Number(req.body.student_fee_record_id);
  if (!Number.isInteger(recordId)) throw new ApiError(422, "student_fee_record_id is required");
  const record = await authorizedRecord(req, recordId);
  if (record.status === "WAIVED") throw new ApiError(400, "Cannot collect payment for a waived record");
  const amountPaise = Math.round(Number(record.balance_amount) * 100);
  const receipt = `fee_${record.id}_${Date.now()}`;
  const order = await paymentService.createOrder({ amountPaise, receipt, recordId: record.id, schoolId: schoolId(req) });
  await query(
    `INSERT INTO fee_payment_orders(
       school_id,student_fee_record_id,student_id,created_by_user_id,razorpay_order_id,amount_paise,currency,status,receipt
     ) VALUES($1,$2,$3,$4,$5,$6,$7,'CREATED',$8)`,
    [schoolId(req), record.id, record.student_id, (req as AuthenticatedRequest).user.id,
      order.id, order.amount, order.currency, order.receipt || receipt],
  );
  res.json({
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    key: config.RAZORPAY_KEY_ID,
    student_fee_record_id: record.id,
    student_name: record.student_name,
    fee_title: record.title,
  });
});

feesRouter.post("/fees/razorpay/verify-payment", async (req, res) => {
  const recordId = Number(req.body.student_fee_record_id);
  const orderId = String(req.body.razorpay_order_id || "");
  const paymentId = String(req.body.razorpay_payment_id || "");
  if (!Number.isInteger(recordId) || !orderId || !paymentId) throw new ApiError(422, "Payment verification fields are required");
  await authorizedRecord(req, recordId);
  const order = (await query<PaymentOrder>(
    `SELECT * FROM fee_payment_orders
     WHERE razorpay_order_id=$1 AND student_fee_record_id=$2 AND school_id=$3`,
    [orderId, recordId, schoolId(req)],
  )).rows[0];
  if (!order) throw new ApiError(404, "Payment order not found");
  paymentService.verifyCheckoutSignature(order.razorpay_order_id, paymentId, req.body.razorpay_signature);
  const payment = await paymentService.fetchPayment(paymentId);
  if (payment.order_id !== order.razorpay_order_id) throw new ApiError(400, "Payment does not belong to this order");
  if (!payment.captured && payment.status !== "captured") throw new ApiError(409, "Payment is authorized but not captured yet");
  const receipt = await finalizeCapturedPayment({
    orderId: order.razorpay_order_id,
    paymentId,
    amountPaise: payment.amount,
    currency: payment.currency,
    signature: req.body.razorpay_signature,
    expectedSchoolId: schoolId(req),
  });
  res.json(receipt);
});
