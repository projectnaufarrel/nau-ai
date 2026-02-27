-- Organizations (single row for MVP: KM ITB)
CREATE TABLE IF NOT EXISTS organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id),
  title      TEXT NOT NULL,
  doc_type   TEXT NOT NULL, -- 'constitution', 'procedure', 'guide', 'faq'
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Document sections (the searchable units)
CREATE TABLE IF NOT EXISTS document_sections (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    UUID NOT NULL REFERENCES documents(id),
  section_title  TEXT,
  content        TEXT NOT NULL,
  section_order  INTEGER NOT NULL,
  search_vector  TSVECTOR,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_document_sections_search
  ON document_sections USING GIN (search_vector);

-- Trigger: auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('indonesian', COALESCE(NEW.content, '') || ' ' || COALESCE(NEW.section_title, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_search_vector ON document_sections;
CREATE TRIGGER trg_update_search_vector
  BEFORE INSERT OR UPDATE ON document_sections
  FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_platform_id TEXT NOT NULL,
  platform         TEXT NOT NULL, -- 'line' or 'web'
  messages         JSONB NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
