-- Supabase RPC function for full-text search with document metadata
-- Returns sections with relevance scores — feeds directly into the citation system
CREATE OR REPLACE FUNCTION search_sections(query_text TEXT, result_limit INTEGER DEFAULT 5)
RETURNS TABLE (
  section_id      UUID,
  document_title  TEXT,
  section_title   TEXT,
  doc_type        TEXT,
  content         TEXT,
  rank            REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ds.id AS section_id,
    d.title AS document_title,
    ds.section_title,
    d.doc_type,
    ds.content,
    ts_rank(ds.search_vector, plainto_tsquery('indonesian', query_text)) AS rank
  FROM document_sections ds
  JOIN documents d ON d.id = ds.document_id
  WHERE ds.search_vector @@ plainto_tsquery('indonesian', query_text)
  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;
