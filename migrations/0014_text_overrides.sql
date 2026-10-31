-- Text the cis edition's operator has rewritten in the text editor
-- (editorWorker.ts): one row per language and string key. The site's Worker
-- serves them at GET /api/text and the app lays them over its own words.
CREATE TABLE IF NOT EXISTS text_overrides (
    lang       TEXT    NOT NULL,
    key        TEXT    NOT NULL,
    value      TEXT    NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (lang, key)
);
