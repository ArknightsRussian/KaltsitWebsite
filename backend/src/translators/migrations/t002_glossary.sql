-- The team glossary, read from its Google Sheet (xlsx export) and replaced
-- whole on every successful download. The site never edits it.

CREATE TABLE IF NOT EXISTS translators.glossary_terms (
    id SERIAL PRIMARY KEY,
    sheet TEXT NOT NULL,
    row_no INTEGER NOT NULL,
    -- The English as written (all variants) and the one variant this entry searches for.
    en TEXT NOT NULL,
    key TEXT NOT NULL,
    qualifier TEXT,
    ru TEXT NOT NULL,
    ru_plural TEXT,
    note TEXT,
    synonyms TEXT,
    comment TEXT,
    cn TEXT,
    case_sensitive BOOLEAN NOT NULL,
    -- From the sheet copied from Sova's glossary: a variant, never checked with a cross.
    from_sova BOOLEAN NOT NULL,
    -- Story lines whose English holds the key (recounted after each download and import).
    story_lines INTEGER NOT NULL DEFAULT 0
);

-- One row: the last successful download, and the last attempt.
CREATE TABLE IF NOT EXISTS translators.glossary_meta (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    fetched_at TIMESTAMPTZ,
    sha256 TEXT,
    attempted_at TIMESTAMPTZ,
    last_error TEXT
);
