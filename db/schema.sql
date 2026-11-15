-- Base de datos de FilaCero. Preparar protección de datos y auditoría antes de producción.
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY,
  full_name VARCHAR(110) NOT NULL,
  clinic VARCHAR(100) NOT NULL,
  curp_hash CHAR(64),
  nss_hash CHAR(64),
  phone_last4 VARCHAR(4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS patient_documents (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  file_name VARCHAR(100) NOT NULL,
  mime_type VARCHAR(30) NOT NULL,
  content BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS triage_evaluations (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  level VARCHAR(40) NOT NULL,
  color VARCHAR(12) NOT NULL,
  title VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  answers JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ticket_sequence (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_number INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS turns (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  code VARCHAR(12) NOT NULL,
  clinic VARCHAR(100) NOT NULL,
  priority VARCHAR(40) NOT NULL,
  priority_color VARCHAR(12) NOT NULL,
  status VARCHAR(35) NOT NULL DEFAULT 'En espera',
  room VARCHAR(60),
  nonce VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_turns_code ON turns(code);
CREATE INDEX IF NOT EXISTS idx_turns_clinic_status ON turns(clinic,status,created_at);
