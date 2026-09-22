-- Dedicated INTAKE_RECEIPTS database only. No automatic PII deletion policy.
CREATE TABLE intake_receipts (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  fingerprint TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX intake_admission_day ON intake_receipts(created_at);
CREATE INDEX intake_admission_ip ON intake_receipts(ip_hash, created_at);
CREATE TABLE intake_outbox (
  receipt_id TEXT PRIMARY KEY REFERENCES intake_receipts(id),
  email_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','retry','provider_accepted','dead_letter','needs_review')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 6),
  first_attempt_at INTEGER,
  next_attempt_at INTEGER NOT NULL,
  lease_token TEXT,
  lease_until INTEGER,
  provider_id TEXT,
  last_code TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX intake_outbox_due ON intake_outbox(status, next_attempt_at);
-- Counts every network attempt, not just accepted messages: deliberately conservative.
CREATE TABLE intake_attempts (
  receipt_id TEXT NOT NULL REFERENCES intake_outbox(receipt_id),
  attempt INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  PRIMARY KEY(receipt_id, attempt)
);
CREATE INDEX intake_attempts_day ON intake_attempts(started_at);
CREATE TABLE intake_rate (
  ip_hash TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  hits INTEGER NOT NULL,
  PRIMARY KEY(ip_hash, bucket)
);
