-- A sprite named from the game's character table (an operator) is certain;
-- one named by who talks after it is a guess, shown as such.
ALTER TABLE translators.char_names ADD COLUMN IF NOT EXISTS guessed BOOLEAN NOT NULL DEFAULT TRUE;

-- The Russian of the story library's chapter and story names as the game
-- shows them (ArknightsRU dictionaries), for the chapter and story pickers.
-- Rebuilt by the import.
CREATE TABLE IF NOT EXISTS translators.names_ru (
    en TEXT PRIMARY KEY,
    ru TEXT NOT NULL
);
