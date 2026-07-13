BEGIN;

CREATE TABLE IF NOT EXISTS schools (
  id SERIAL PRIMARY KEY, name VARCHAR(200) NOT NULL, slug VARCHAR(220) UNIQUE NOT NULL,
  school_code VARCHAR(40) UNIQUE NOT NULL, institution_type VARCHAR(50) NOT NULL DEFAULT 'school',
  email VARCHAR(255), phone VARCHAR(30), address TEXT, city VARCHAR(120), state VARCHAR(120),
  country VARCHAR(120) DEFAULT 'India', logo_url VARCHAR(500), is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL, phone VARCHAR(30), login_id VARCHAR(255) NOT NULL, hashed_password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'SCHOOL_ADMIN', is_active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE, password_reset_token_hash VARCHAR(255),
  password_reset_expires_at TIMESTAMP, last_login_at TIMESTAMP, failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, login_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_school_email ON users(school_id, lower(email));
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash VARCHAR(128) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL, revoked_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT NOW(), last_used_at TIMESTAMP,
  replaced_by_token_id INTEGER, user_agent VARCHAR(512), ip_address VARCHAR(64)
);
CREATE TABLE IF NOT EXISTS pending_school_registrations (
  id SERIAL PRIMARY KEY, owner_email VARCHAR(255) NOT NULL, otp_hash VARCHAR(255) NOT NULL, payload_json TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS school_branding (
  id SERIAL PRIMARY KEY, school_id INTEGER UNIQUE NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  logo_url VARCHAR(500), favicon_url VARCHAR(500), primary_color VARCHAR(20) DEFAULT '#2563eb', secondary_color VARCHAR(20) DEFAULT '#0f172a',
  accent_color VARCHAR(20) DEFAULT '#22c55e', sidebar_color VARCHAR(20) DEFAULT '#0f172a', background_color VARCHAR(20) DEFAULT '#f8fafc',
  text_color VARCHAR(20) DEFAULT '#0f172a', theme_mode VARCHAR(20) DEFAULT 'light', theme_source VARCHAR(30) DEFAULT 'preset',
  preset_name VARCHAR(50) DEFAULT 'professional_blue', border_radius INTEGER DEFAULT 16,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS academic_sessions (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, name VARCHAR(120) NOT NULL,
  start_date DATE, end_date DATE, is_active BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL, name VARCHAR(120) NOT NULL,
  code VARCHAR(50), description TEXT, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS school_classes (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL, department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL, code VARCHAR(50), sections TEXT, is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sections (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL, class_id INTEGER NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL, department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  class_id INTEGER REFERENCES school_classes(id) ON DELETE CASCADE, name VARCHAR(120) NOT NULL, code VARCHAR(50), sections TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS parent_guardians (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  full_name VARCHAR(150) NOT NULL, relation VARCHAR(80), email VARCHAR(255), phone VARCHAR(30), alternate_phone VARCHAR(30),
  occupation VARCHAR(120), address TEXT, is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  guardian_id INTEGER REFERENCES parent_guardians(id) ON DELETE SET NULL, class_id INTEGER REFERENCES school_classes(id) ON DELETE SET NULL,
  section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL, section_name VARCHAR(80), admission_no VARCHAR(80) NOT NULL,
  roll_number VARCHAR(80), first_name VARCHAR(120) NOT NULL, last_name VARCHAR(120), email VARCHAR(255), phone VARCHAR(30),
  gender VARCHAR(30), date_of_birth DATE, blood_group VARCHAR(20), photo_url VARCHAR(500), address TEXT, admission_date DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(), UNIQUE(school_id, admission_no)
);
CREATE TABLE IF NOT EXISTS teachers (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL, employee_id VARCHAR(80) NOT NULL, full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255), phone VARCHAR(30), gender VARCHAR(30), qualification VARCHAR(150), specialization VARCHAR(150), joining_date DATE,
  photo_url VARCHAR(500), address TEXT, status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(), UNIQUE(school_id, employee_id)
);
CREATE TABLE IF NOT EXISTS teacher_subjects (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL, teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, class_id INTEGER REFERENCES school_classes(id) ON DELETE SET NULL,
  section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL, section_name VARCHAR(80), created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(teacher_id, subject_id, class_id, section_id)
);
CREATE TABLE IF NOT EXISTS class_teacher_assignments (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE, class_id INTEGER NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL, section_name VARCHAR(80), academic_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), UNIQUE(school_id,class_id,section_id,academic_session_id)
);
CREATE TABLE IF NOT EXISTS student_attendance (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, session_id INTEGER NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, class_id INTEGER NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL, section_name VARCHAR(80), marked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  date DATE NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'PRESENT', note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(), UNIQUE(school_id,session_id,student_id,date)
);
CREATE TABLE IF NOT EXISTS homework_assignments (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  class_id INTEGER NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE, section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
  section_name VARCHAR(80), subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL, academic_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL,
  title VARCHAR(180) NOT NULL, description TEXT, due_date DATE NOT NULL, attachment_url VARCHAR(500), attachment_filename VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS homework_submissions (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, homework_id INTEGER NOT NULL REFERENCES homework_assignments(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, answer_text TEXT, attachment_url VARCHAR(500), attachment_filename VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED', teacher_feedback TEXT, checked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(), UNIQUE(school_id,homework_id,student_id)
);
CREATE TABLE IF NOT EXISTS timetable_periods (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, period_number INTEGER NOT NULL, name VARCHAR(120) NOT NULL,
  start_time TIME, end_time TIME, is_break BOOLEAN DEFAULT FALSE, is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(), UNIQUE(school_id,period_number)
);
CREATE TABLE IF NOT EXISTS timetable_days (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, day_of_week VARCHAR(20) NOT NULL,
  display_name VARCHAR(80) NOT NULL, sort_order INTEGER DEFAULT 1, is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(), UNIQUE(school_id,day_of_week)
);
CREATE TABLE IF NOT EXISTS timetable_entries (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, academic_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL,
  class_id INTEGER NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE, section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL, section_name VARCHAR(80),
  day_id INTEGER NOT NULL REFERENCES timetable_days(id) ON DELETE CASCADE, period_id INTEGER NOT NULL REFERENCES timetable_periods(id) ON DELETE CASCADE,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL, teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL, room VARCHAR(120), note TEXT,
  is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id,academic_session_id,class_id,section_id,day_id,period_id)
);
CREATE TABLE IF NOT EXISTS exams (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, academic_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL,
  class_id INTEGER NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE, section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL, section_name VARCHAR(80),
  name VARCHAR(180) NOT NULL, exam_type VARCHAR(80), description TEXT, start_date DATE, end_date DATE, result_status VARCHAR(30) DEFAULT 'DRAFT',
  is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(), published_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS exam_subjects (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  max_marks DOUBLE PRECISION DEFAULT 100, pass_marks DOUBLE PRECISION DEFAULT 33, exam_date DATE, start_time TIME, end_time TIME, room VARCHAR(120), timetable_note TEXT,
  is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(), UNIQUE(school_id,exam_id,subject_id)
);
CREATE TABLE IF NOT EXISTS exam_marks (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, exam_subject_id INTEGER NOT NULL REFERENCES exam_subjects(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, marks_obtained DOUBLE PRECISION, grade VARCHAR(20), is_absent BOOLEAN DEFAULT FALSE,
  pass_status VARCHAR(30) DEFAULT 'PENDING', remarks TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id,exam_subject_id,student_id)
);
CREATE TABLE IF NOT EXISTS fee_categories (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, name VARCHAR(140) NOT NULL, code VARCHAR(50), description TEXT,
  is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(), UNIQUE(school_id,name)
);
CREATE TABLE IF NOT EXISTS fee_structures (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, category_id INTEGER NOT NULL REFERENCES fee_categories(id) ON DELETE CASCADE,
  academic_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL, name VARCHAR(180) NOT NULL, amount DOUBLE PRECISION NOT NULL, due_date DATE,
  description TEXT, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS fee_assignments (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, fee_structure_id INTEGER NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
  academic_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL, class_id INTEGER REFERENCES school_classes(id) ON DELETE SET NULL,
  section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL, section_name VARCHAR(80), student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  assigned_amount DOUBLE PRECISION, due_date DATE, note TEXT, is_active BOOLEAN DEFAULT TRUE, generated_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS student_fee_records (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_structure_id INTEGER REFERENCES fee_structures(id) ON DELETE SET NULL, fee_assignment_id INTEGER REFERENCES fee_assignments(id) ON DELETE SET NULL,
  academic_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL, title VARCHAR(180) NOT NULL, amount DOUBLE PRECISION NOT NULL,
  discount_amount DOUBLE PRECISION DEFAULT 0, fine_amount DOUBLE PRECISION DEFAULT 0, paid_amount DOUBLE PRECISION DEFAULT 0,
  balance_amount DOUBLE PRECISION DEFAULT 0, due_date DATE, status VARCHAR(30) DEFAULT 'PENDING', note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(), UNIQUE(student_id,fee_assignment_id)
);
CREATE TABLE IF NOT EXISTS fee_payments (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, student_fee_record_id INTEGER NOT NULL REFERENCES student_fee_records(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, collected_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  receipt_no VARCHAR(80) NOT NULL, amount DOUBLE PRECISION NOT NULL, payment_date DATE DEFAULT CURRENT_DATE, payment_mode VARCHAR(50) DEFAULT 'CASH',
  reference_no VARCHAR(120), note TEXT, razorpay_order_id VARCHAR(100), razorpay_payment_id VARCHAR(100), razorpay_signature VARCHAR(256),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), UNIQUE(school_id,receipt_no)
);
CREATE TABLE IF NOT EXISTS fee_expenses (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(180) NOT NULL, category VARCHAR(120), amount DOUBLE PRECISION NOT NULL, expense_date DATE DEFAULT CURRENT_DATE,
  payment_mode VARCHAR(50) DEFAULT 'CASH', vendor_name VARCHAR(180), reference_no VARCHAR(120), note TEXT, is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS communication_announcements (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL, message TEXT NOT NULL, priority VARCHAR(20) DEFAULT 'NORMAL', status VARCHAR(20) DEFAULT 'DRAFT', audience_roles TEXT,
  start_at TIMESTAMP, end_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS communication_events (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL, description TEXT, event_date DATE NOT NULL, end_date DATE, start_time TIME, end_time TIME, location VARCHAR(255),
  category VARCHAR(120), status VARCHAR(20) DEFAULT 'PUBLISHED', audience_roles TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS complaints (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL, subject VARCHAR(255) NOT NULL, description TEXT NOT NULL, category VARCHAR(120),
  priority VARCHAR(20) DEFAULT 'NORMAL', status VARCHAR(30) DEFAULT 'SUBMITTED', action_taken TEXT, is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(), resolved_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS in_app_notifications (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  target_role VARCHAR(50), target_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, title VARCHAR(255) NOT NULL, message TEXT NOT NULL,
  category VARCHAR(80), priority VARCHAR(20) DEFAULT 'NORMAL', link VARCHAR(500), expires_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS in_app_notification_reads (
  id SERIAL PRIMARY KEY, notification_id INTEGER NOT NULL REFERENCES in_app_notifications(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, read_at TIMESTAMP NOT NULL DEFAULT NOW(), UNIQUE(notification_id,user_id)
);
CREATE TABLE IF NOT EXISTS notices (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL, content TEXT NOT NULL, priority VARCHAR(20) DEFAULT 'NORMAL', status VARCHAR(20) DEFAULT 'PUBLISHED',
  is_pinned BOOLEAN DEFAULT FALSE, pinned_by INTEGER REFERENCES users(id) ON DELETE SET NULL, publish_at TIMESTAMPTZ, expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS notice_audiences (id SERIAL PRIMARY KEY, notice_id INTEGER NOT NULL REFERENCES notices(id) ON DELETE CASCADE, role VARCHAR(50) NOT NULL, UNIQUE(notice_id,role));
CREATE TABLE IF NOT EXISTS notice_reads (id SERIAL PRIMARY KEY, notice_id INTEGER NOT NULL REFERENCES notices(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, read_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(notice_id,user_id));
CREATE TABLE IF NOT EXISTS notice_class_audiences (id SERIAL PRIMARY KEY, notice_id INTEGER NOT NULL REFERENCES notices(id) ON DELETE CASCADE, class_id INTEGER NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE, section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL, section_name VARCHAR(80));
CREATE TABLE IF NOT EXISTS library_books (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, title VARCHAR(300) NOT NULL, author VARCHAR(200) NOT NULL,
  isbn VARCHAR(30), publisher VARCHAR(200), edition VARCHAR(80), category VARCHAR(100), language VARCHAR(60) DEFAULT 'English', shelf_location VARCHAR(100),
  description TEXT, cover_url VARCHAR(500), total_copies INTEGER NOT NULL DEFAULT 1, available_copies INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(), UNIQUE(school_id,isbn)
);
CREATE TABLE IF NOT EXISTS library_issues (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, book_id INTEGER NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE SET NULL, teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  issued_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, borrower_name VARCHAR(200) NOT NULL, issued_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  returned_to INTEGER REFERENCES users(id) ON DELETE SET NULL, issue_date DATE NOT NULL, due_date DATE NOT NULL, return_date DATE,
  status VARCHAR(20) DEFAULT 'ISSUED', fine_per_day INTEGER DEFAULT 1, fine_amount INTEGER DEFAULT 0, fine_paid BOOLEAN DEFAULT FALSE,
  notes TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS meetings (
  id SERIAL PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, bbb_meeting_id VARCHAR(255) UNIQUE,
  attendee_password VARCHAR(100), moderator_password VARCHAR(100), title VARCHAR(255) NOT NULL, meeting_type VARCHAR(30) NOT NULL,
  status VARCHAR(30) DEFAULT 'live', created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, class_id INTEGER REFERENCES school_classes(id) ON DELETE SET NULL,
  section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL, section_name VARCHAR(80), teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  record BOOLEAN DEFAULT TRUE, recording_url TEXT, scheduled_at TIMESTAMPTZ, started_at TIMESTAMPTZ, ended_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, class_id INTEGER REFERENCES school_classes(id) ON DELETE SET NULL,
  section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL, section_name VARCHAR(80), subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  academic_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL, title VARCHAR(255) NOT NULL, description TEXT, thumbnail_url VARCHAR(500),
  teacher_id INTEGER NOT NULL REFERENCES users(id), status VARCHAR(30) DEFAULT 'PUBLISHED', is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS lessons (
  id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT, "order" INTEGER DEFAULT 1, video_url VARCHAR(500), pdf_url VARCHAR(500),
  external_video_link VARCHAR(500), transcript TEXT, notes TEXT, video_public_id VARCHAR(255), pdf_public_id VARCHAR(255),
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE, created_at TIMESTAMPTZ DEFAULT NOW(), language VARCHAR(10) DEFAULT 'en', summary TEXT
);
CREATE TABLE IF NOT EXISTS lesson_chunk (
  id SERIAL PRIMARY KEY, content TEXT NOT NULL, source VARCHAR(50) NOT NULL, chunk_index INTEGER DEFAULT 0,
  embedding JSONB, lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  start_time DOUBLE PRECISION, end_time DOUBLE PRECISION
);
CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  progress DOUBLE PRECISION DEFAULT 0, enrolled_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(student_id,course_id)
);
CREATE TABLE IF NOT EXISTS lesson_progress (
  id SERIAL PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE, completed_at TIMESTAMPTZ, UNIQUE(student_id,lesson_id)
);
CREATE TABLE IF NOT EXISTS video_watch_progress (
  id SERIAL PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  watched_seconds DOUBLE PRECISION DEFAULT 0, video_duration_seconds DOUBLE PRECISION DEFAULT 0, max_position_seconds DOUBLE PRECISION DEFAULT 0,
  last_position_seconds DOUBLE PRECISION DEFAULT 0, last_watch_ping_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(student_id,lesson_id)
);
CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT, due_date TIMESTAMPTZ, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES users(id), assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  file_url VARCHAR(500), file_public_id VARCHAR(255), grade DOUBLE PRECISION, feedback TEXT, submitted_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(student_id,assignment_id)
);
CREATE TABLE IF NOT EXISTS chat_session (
  id VARCHAR(36) PRIMARY KEY, title VARCHAR(255), user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS chat_message (
  id SERIAL PRIMARY KEY, role VARCHAR(30) NOT NULL, content TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), session_id VARCHAR(36) NOT NULL REFERENCES chat_session(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, tool_calls JSONB, tool_call_id VARCHAR(100), is_enhanced BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_students_school_class ON students(school_id,class_id,section_id,is_active);
CREATE INDEX IF NOT EXISTS idx_teachers_school ON teachers(school_id,is_active);
CREATE INDEX IF NOT EXISTS idx_attendance_school_date ON student_attendance(school_id,date,class_id);
CREATE INDEX IF NOT EXISTS idx_homework_school_due ON homework_assignments(school_id,due_date);
CREATE INDEX IF NOT EXISTS idx_timetable_lookup ON timetable_entries(school_id,class_id,section_id,day_id);
CREATE INDEX IF NOT EXISTS idx_exam_school_date ON exams(school_id,start_date);
CREATE INDEX IF NOT EXISTS idx_fee_record_school_status ON student_fee_records(school_id,status,due_date);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON in_app_notifications(school_id,target_user_id,target_role,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notices_school_created ON notices(school_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_issue_due ON library_issues(school_id,status,due_date);
CREATE INDEX IF NOT EXISTS idx_courses_school ON courses(school_id,is_active,class_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_session ON chat_message(session_id,created_at);

CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO schema_migrations(filename) VALUES('001_initial.sql') ON CONFLICT DO NOTHING;
COMMIT;
