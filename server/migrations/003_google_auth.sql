BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_subject VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_linked_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_school_google_subject
  ON users(school_id, google_subject)
  WHERE google_subject IS NOT NULL;

CREATE TABLE IF NOT EXISTS oauth_login_codes (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash VARCHAR(128) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_login_codes_expires_at
  ON oauth_login_codes(expires_at);

COMMIT;
