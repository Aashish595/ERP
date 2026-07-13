CREATE TABLE IF NOT EXISTS fee_payment_orders (
  id BIGSERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_fee_record_id INTEGER NOT NULL REFERENCES student_fee_records(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  razorpay_order_id VARCHAR(100) NOT NULL UNIQUE,
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 100),
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
  receipt VARCHAR(80) NOT NULL,
  razorpay_payment_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fee_payments_razorpay_payment
  ON fee_payments(razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fee_payments_razorpay_order
  ON fee_payments(razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fee_payment_orders_record
  ON fee_payment_orders(school_id, student_fee_record_id, created_at DESC);

CREATE TABLE IF NOT EXISTS meeting_attendance (
  id BIGSERIAL PRIMARY KEY,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  first_joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  join_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(meeting_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_attendance_meeting
  ON meeting_attendance(meeting_id, first_joined_at);
