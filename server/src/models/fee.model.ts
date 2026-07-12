import { defineModel } from "../core/model.js";

export interface FeeCategoryRecord extends Record<string, unknown> {
  id: number;
  name?: unknown;
  code?: unknown;
  description?: unknown;
  is_active?: unknown;
}

export const FeeCategoryModel = defineModel<FeeCategoryRecord>({
  name: "FeeCategory", table: "fee_categories", primaryKey: "id",
  fields: ["name","code","description","is_active"],
  requiredFields: ["name"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});

export interface FeeStructureRecord extends Record<string, unknown> {
  id: number;
  category_id?: unknown;
  academic_session_id?: unknown;
  name?: unknown;
  amount?: unknown;
  due_date?: unknown;
  description?: unknown;
  is_active?: unknown;
}

export const FeeStructureModel = defineModel<FeeStructureRecord>({
  name: "FeeStructure", table: "fee_structures", primaryKey: "id",
  fields: ["category_id","academic_session_id","name","amount","due_date","description","is_active"],
  requiredFields: ["category_id","name","amount"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});

export interface FeeAssignmentRecord extends Record<string, unknown> {
  id: number;
  fee_structure_id?: unknown;
  academic_session_id?: unknown;
  class_id?: unknown;
  section_id?: unknown;
  section_name?: unknown;
  student_id?: unknown;
  assigned_amount?: unknown;
  due_date?: unknown;
  note?: unknown;
  is_active?: unknown;
  generated_at?: unknown;
}

export const FeeAssignmentModel = defineModel<FeeAssignmentRecord>({
  name: "FeeAssignment", table: "fee_assignments", primaryKey: "id",
  fields: ["fee_structure_id","academic_session_id","class_id","section_id","section_name","student_id","assigned_amount","due_date","note","is_active","generated_at"],
  requiredFields: ["fee_structure_id"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});

export interface StudentFeeRecordRecord extends Record<string, unknown> {
  id: number;
  student_id?: unknown;
  fee_structure_id?: unknown;
  fee_assignment_id?: unknown;
  academic_session_id?: unknown;
  title?: unknown;
  amount?: unknown;
  discount_amount?: unknown;
  fine_amount?: unknown;
  paid_amount?: unknown;
  balance_amount?: unknown;
  due_date?: unknown;
  status?: unknown;
  note?: unknown;
}

export const StudentFeeRecordModel = defineModel<StudentFeeRecordRecord>({
  name: "StudentFeeRecord", table: "student_fee_records", primaryKey: "id",
  fields: ["student_id","fee_structure_id","fee_assignment_id","academic_session_id","title","amount","discount_amount","fine_amount","paid_amount","balance_amount","due_date","status","note"],
  requiredFields: ["student_id","title","amount"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
});

export interface FeePaymentRecord extends Record<string, unknown> {
  id: number;
  student_fee_record_id?: unknown;
  student_id?: unknown;
  collected_by_user_id?: unknown;
  receipt_no?: unknown;
  amount?: unknown;
  payment_date?: unknown;
  payment_mode?: unknown;
  reference_no?: unknown;
  note?: unknown;
  razorpay_order_id?: unknown;
  razorpay_payment_id?: unknown;
  razorpay_signature?: unknown;
}

export const FeePaymentModel = defineModel<FeePaymentRecord>({
  name: "FeePayment", table: "fee_payments", primaryKey: "id",
  fields: ["student_fee_record_id","student_id","collected_by_user_id","receipt_no","amount","payment_date","payment_mode","reference_no","note","razorpay_order_id","razorpay_payment_id","razorpay_signature"],
  requiredFields: ["student_fee_record_id","student_id","receipt_no","amount"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: false,
});

export interface FeeExpenseRecord extends Record<string, unknown> {
  id: number;
  created_by_user_id?: unknown;
  title?: unknown;
  category?: unknown;
  amount?: unknown;
  expense_date?: unknown;
  payment_mode?: unknown;
  vendor_name?: unknown;
  reference_no?: unknown;
  note?: unknown;
  is_active?: unknown;
}

export const FeeExpenseModel = defineModel<FeeExpenseRecord>({
  name: "FeeExpense", table: "fee_expenses", primaryKey: "id",
  fields: ["created_by_user_id","title","category","amount","expense_date","payment_mode","vendor_name","reference_no","note","is_active"],
  requiredFields: ["title","amount"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});

