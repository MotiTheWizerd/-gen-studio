CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS personas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL DEFAULT 'default',
  name           TEXT NOT NULL,
  facial_details TEXT NOT NULL DEFAULT '',
  body_shape     TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personas_user_id ON personas(user_id);

CREATE TABLE IF NOT EXISTS persona_images (
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  slot       TEXT NOT NULL CHECK (slot IN ('face','body','ref_1','ref_2','ref_3')),
  filename   TEXT NOT NULL,
  mime       TEXT NOT NULL,
  width      INT  NOT NULL DEFAULT 0,
  height     INT  NOT NULL DEFAULT 0,
  bytes      BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (persona_id, slot)
);
