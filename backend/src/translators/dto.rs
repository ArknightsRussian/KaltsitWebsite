//! Wire types of the translators' section.

use serde::Serialize;
use ts_rs::TS;
use utoipa::ToSchema;

/// What the page needs to know about the caller.
#[derive(Debug, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct TranslatorsMe {
    /// A signed-in translator: sees Sova's and the AI's texts.
    pub member: bool,
    /// The development sign-in is switched on for this backend.
    pub dev_login: bool,
}

/// One displayed text of a story with its Russian and the hints.
#[derive(Debug, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct TranslatorLine {
    /// 1-based line in the EN script.
    pub line: u32,
    /// The option number of a decision (1-based), else 0.
    pub part: i16,
    /// `dialog`, `narration`, `subtitle`, `sticker` or `option`.
    pub kind: String,
    pub speaker_en: String,
    pub speaker_ru: Option<String>,
    pub en: String,
    /// The Russian the game shows now.
    pub ru_game: Option<String>,
    /// `plugin:story` or the dictionary file it came from.
    pub ru_game_source: Option<String>,
    /// `exact`, `normalized`, `lines` or `plugin`.
    pub ru_game_match: Option<String>,
    /// `story` when the text is in the plugin's catalog, `ambiguous:story` when the plugin leaves it in English.
    pub plugin_role: Option<String>,
    /// The dictionary's value when the plugin's differs.
    pub ru_dict: Option<String>,
    pub speaker_cn: Option<String>,
    pub cn: Option<String>,
    /// Sova's translation: signed-in translators only.
    pub sova: Option<String>,
    /// The AI's translation: signed-in translators only.
    pub ai: Option<String>,
    /// Glossary terms found in the English, in order.
    pub terms: Vec<LineTerm>,
}

/// One story's lines.
#[derive(Debug, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct TranslatorStoryLines {
    pub story_id: String,
    /// Unix seconds of the last import, null when nothing was imported yet.
    #[ts(type = "number | null")]
    pub imported_at: Option<i64>,
    /// The lines carry Sova's and the AI's texts.
    pub hints: bool,
    pub lines: Vec<TranslatorLine>,
}

/// The import's state (service key only; not used by the page).
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ImportStatus {
    pub running: bool,
    /// Why the last run failed, while this process remembers it.
    pub error: Option<String>,
    /// Unix seconds of the last finished import.
    pub last_finished_at: Option<i64>,
    /// The last finished import's summary (`ImportSummary`).
    #[schema(value_type = Object)]
    pub last: Option<serde_json::Value>,
}

/// A glossary term found in a line's English.
#[derive(Debug, Clone, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct LineTerm {
    pub term_id: i32,
    /// The text as it stands in the English line.
    pub matched: String,
    pub sheet: String,
    pub ru: String,
    pub ru_plural: Option<String>,
    pub qualifier: Option<String>,
    pub note: Option<String>,
    /// From the sheet copied from Sova's glossary: a variant, never marked as not found.
    pub from_sova: bool,
    /// Whether the line's Russian holds the glossary form (by stem, ё = е); null when not checked.
    pub found: Option<bool>,
}

/// One glossary entry for the Glossary tab.
#[derive(Debug, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct GlossaryTerm {
    pub id: i32,
    pub sheet: String,
    /// 1-based row in the sheet.
    pub row: i32,
    /// The English cell as written.
    pub en: String,
    /// The English the site searches for.
    pub key: String,
    pub qualifier: Option<String>,
    pub ru: String,
    pub ru_plural: Option<String>,
    pub note: Option<String>,
    pub synonyms: Option<String>,
    pub comment: Option<String>,
    pub cn: Option<String>,
    pub case_sensitive: bool,
    pub from_sova: bool,
    /// Story lines whose English holds the key.
    pub story_lines: i32,
}

/// The whole stored glossary and its freshness.
#[derive(Debug, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Glossary {
    /// The Google Sheet, to open and edit it.
    pub sheet_url: String,
    /// Unix seconds of the stored copy's download, null when there is none.
    #[ts(type = "number | null")]
    pub fetched_at: Option<i64>,
    /// Unix seconds of the last attempt, successful or not.
    #[ts(type = "number | null")]
    pub attempted_at: Option<i64>,
    /// Why the last attempt failed (the stored copy is older then).
    pub last_error: Option<String>,
    /// A download is running now.
    pub refreshing: bool,
    pub terms: Vec<GlossaryTerm>,
}
