-- The translators' section ("Для переводчиков") keeps everything in its own
-- schema with its own migration ledger (`translators._migrations`), so the
-- upstream `vNNN` sequence never has to make room for it.

CREATE SCHEMA IF NOT EXISTS translators;

-- Who counts as a signed-in translator. Hint texts (Sova, AI) are shown to
-- members only.
CREATE TABLE IF NOT EXISTS translators.members (
    user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    note TEXT,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One displayed text of one story: a dialogue line, a narration, a subtitle
-- or sticker, or ONE option of a decision (`part` = option number, else 0).
-- `line` is the site parser's 1-based line in the EN script.
-- Rebuilt whole by the import (`DELETE` + insert in one transaction).
CREATE TABLE IF NOT EXISTS translators.story_lines (
    server TEXT NOT NULL,
    story_id TEXT NOT NULL,
    line INTEGER NOT NULL,
    part SMALLINT NOT NULL,
    ord INTEGER NOT NULL,
    kind TEXT NOT NULL,
    speaker_en TEXT NOT NULL DEFAULT '',
    speaker_ru TEXT,
    en TEXT NOT NULL,
    -- What the game shows now with the ArknightsRU pack, and where it came from:
    -- `plugin:story` (RichTextFix catalog) or the dictionary file name.
    ru_game TEXT,
    ru_game_source TEXT,
    -- `exact` | `normalized` | `lines` (matched line by line) | `plugin`.
    ru_game_match TEXT,
    -- The RichTextFix role whose catalog holds this text: an edit through the
    -- dictionaries may not take effect. `ambiguous:story` = shown untranslated.
    plugin_role TEXT,
    -- The dictionary's own value when the plugin's differs from it.
    ru_dict TEXT,
    speaker_cn TEXT,
    cn TEXT,
    sova TEXT,
    ai TEXT,
    -- `src_line` | `text`: how the arktr row was attached.
    arktr_match TEXT,
    PRIMARY KEY (server, story_id, line, part)
);

CREATE INDEX IF NOT EXISTS story_lines_story_ord ON translators.story_lines (server, story_id, ord);

-- One row per import run: what it read and what it attached.
CREATE TABLE IF NOT EXISTS translators.imports (
    id BIGSERIAL PRIMARY KEY,
    server TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    summary JSONB NOT NULL
);
