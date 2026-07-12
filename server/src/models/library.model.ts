import { defineModel } from "../core/model.js";

export interface BookRecord extends Record<string, unknown> {
  id: number;
  title?: unknown;
  author?: unknown;
  isbn?: unknown;
  publisher?: unknown;
  edition?: unknown;
  category?: unknown;
  language?: unknown;
  shelf_location?: unknown;
  description?: unknown;
  cover_url?: unknown;
  total_copies?: unknown;
  available_copies?: unknown;
  is_active?: unknown;
}

export const BookModel = defineModel<BookRecord>({
  name: "Book", table: "library_books", primaryKey: "id",
  fields: ["title","author","isbn","publisher","edition","category","language","shelf_location","description","cover_url","total_copies","available_copies","is_active"],
  requiredFields: ["title","author"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});

export interface BookIssueRecord extends Record<string, unknown> {
  id: number;
  book_id?: unknown;
  student_id?: unknown;
  teacher_id?: unknown;
  issued_to_user_id?: unknown;
  borrower_name?: unknown;
  issued_by?: unknown;
  returned_to?: unknown;
  issue_date?: unknown;
  due_date?: unknown;
  return_date?: unknown;
  status?: unknown;
  fine_per_day?: unknown;
  fine_amount?: unknown;
  fine_paid?: unknown;
  notes?: unknown;
}

export const BookIssueModel = defineModel<BookIssueRecord>({
  name: "BookIssue", table: "library_issues", primaryKey: "id",
  fields: ["book_id","student_id","teacher_id","issued_to_user_id","borrower_name","issued_by","returned_to","issue_date","due_date","return_date","status","fine_per_day","fine_amount","fine_paid","notes"],
  requiredFields: ["book_id","borrower_name","issue_date","due_date"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
});

