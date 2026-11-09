-- Roles as decided (2026-11-09): a member may hold several. `translator`
-- (everyone), `editor` (the lead: approves, exports for the game),
-- `maintainer` (builds the pack: exports for the game and marks what went out
-- in a pack version; never approves), `admin` (all of it).
ALTER TABLE translators.members ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT ARRAY['translator'];
UPDATE translators.members SET roles = ARRAY['translator', role] WHERE role <> 'translator';
ALTER TABLE translators.members ADD CONSTRAINT members_roles
    CHECK (roles <@ ARRAY['translator', 'editor', 'maintainer', 'admin']);
ALTER TABLE translators.members DROP COLUMN IF EXISTS role;

-- "Went out in pack <version>": what the maintainer marked, entry by entry,
-- with the text as it went out (a later approval of another text is not out).
CREATE TABLE IF NOT EXISTS translators.releases (
    id BIGSERIAL PRIMARY KEY,
    version TEXT NOT NULL,
    note TEXT,
    released_by UUID REFERENCES users (id) ON DELETE SET NULL,
    released_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS translators.release_items (
    release_id BIGINT NOT NULL REFERENCES translators.releases (id) ON DELETE CASCADE,
    edit_key TEXT NOT NULL,
    text TEXT NOT NULL,
    -- `dictionary` (00_translators.txt / patch), `plugin` (plugin.csv), `context` (context.csv).
    kind TEXT NOT NULL CHECK (kind IN ('dictionary', 'plugin', 'context')),
    story_id TEXT,
    line INTEGER,
    part SMALLINT
);

CREATE INDEX IF NOT EXISTS release_items_key ON translators.release_items (edit_key);
