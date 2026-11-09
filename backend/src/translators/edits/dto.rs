//! Wire types of line editing.

use serde::{Deserialize, Serialize};
use ts_rs::TS;
use utoipa::{IntoParams, ToSchema};

/// A section member as an author or a voter.
#[derive(Debug, Clone, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct EditPerson {
    pub id: String,
    pub name: String,
}

/// One displayed text of one story: where an edit was made.
#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema, IntoParams)]
#[serde(rename_all = "camelCase")]
#[into_params(parameter_in = Query)]
#[ts(export)]
pub struct EditPlace {
    pub story_id: String,
    /// 1-based line in the EN script.
    pub line: i32,
    /// The option number of a decision, else 0.
    pub part: i16,
}

/// A translator's proposed Russian for one dictionary entry.
#[derive(Debug, Clone, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Proposal {
    #[ts(type = "number")]
    pub id: i64,
    pub edit_key: String,
    pub text: String,
    /// `own`, `sova`, `ai` (or `kit`, unused for now).
    pub source: String,
    pub author: EditPerson,
    /// Unix seconds.
    #[ts(type = "number")]
    pub created_at: i64,
    /// Unix seconds of the last rewrite, null when never rewritten.
    #[ts(type = "number | null")]
    pub edited_at: Option<i64>,
    /// Texts it has had, the current one included.
    pub versions: i32,
    /// Who agrees with it.
    pub agreements: Vec<EditPerson>,
    pub place: EditPlace,
    /// Its English is gone from the story since an import.
    pub outdated: bool,
}

/// One text a proposal has had.
#[derive(Debug, Clone, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ProposalVersion {
    pub text: String,
    pub source: String,
    pub author: EditPerson,
    #[ts(type = "number")]
    pub created_at: i64,
}

/// The lead's decision for an entry.
#[derive(Debug, Clone, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Approval {
    /// The approved proposal; null = the game's Russian, checked and kept.
    #[ts(type = "number | null")]
    pub proposal_id: Option<i64>,
    pub text: String,
    pub by: EditPerson,
    #[ts(type = "number")]
    pub at: i64,
}

/// A note on an entry.
#[derive(Debug, Clone, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct EditComment {
    #[ts(type = "number")]
    pub id: i64,
    pub text: String,
    pub author: EditPerson,
    #[ts(type = "number")]
    pub created_at: i64,
    pub resolved_by: Option<EditPerson>,
    #[ts(type = "number | null")]
    pub resolved_at: Option<i64>,
    pub place: EditPlace,
}

/// Everything decided or proposed for one dictionary entry.
#[derive(Debug, Clone, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct KeyEdits {
    pub edit_key: String,
    pub approval: Option<Approval>,
    /// Who keeps the game's Russian ("agree" with it).
    pub game_agreements: Vec<EditPerson>,
    /// Most agreed first, then oldest first.
    pub proposals: Vec<Proposal>,
    /// Oldest first.
    pub comments: Vec<EditComment>,
}

/// An approval or proposal left at a place whose English has changed.
#[derive(Debug, Clone, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct OutdatedEdit {
    /// `proposal` or `approval`.
    pub kind: String,
    pub line: i32,
    pub part: i16,
    /// The English it was made for.
    pub edit_key: String,
    pub text: String,
    pub author: EditPerson,
    #[ts(type = "number")]
    pub at: i64,
}

/// Write or rewrite the caller's proposal for the entry at a place.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProposalInput {
    #[serde(flatten)]
    pub place: EditPlace,
    pub text: String,
    /// `own`, `sova` or `ai`.
    pub source: String,
    /// Required when the entry stands in more than 20 places.
    #[serde(default)]
    pub confirm_many: bool,
}

/// Rewrite one's own proposal.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProposalRewrite {
    pub text: String,
    #[serde(default)]
    pub confirm_many: bool,
}

/// Agree with a variant of the entry at a place, or take it back.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AgreementInput {
    #[serde(flatten)]
    pub place: EditPlace,
    /// The proposal; null = the game's Russian ("keep as in the game").
    pub proposal_id: Option<i64>,
    pub agree: bool,
}

/// A note on the entry at a place.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CommentInput {
    #[serde(flatten)]
    pub place: EditPlace,
    pub text: String,
}

/// Mark a comment resolved, or not.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ResolveInput {
    pub resolved: bool,
}

/// One story line holding the entry.
#[derive(Debug, Clone, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct KeyPlace {
    pub story_id: String,
    pub line: i32,
    pub part: i16,
    /// The line's 0-based order in its story (the table's № minus one).
    pub ord: i32,
}

/// Every place of the entry at a place.
#[derive(Debug, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct KeyPlaces {
    pub edit_key: String,
    pub total: i32,
    /// Up to 500, in story order.
    pub places: Vec<KeyPlace>,
}

/// "My edits": which proposals.
#[derive(Debug, Deserialize, IntoParams)]
#[serde(rename_all = "camelCase")]
#[into_params(parameter_in = Query)]
pub struct EditsQuery {
    /// Everyone's (the lead only); else the caller's.
    #[serde(default)]
    pub all: bool,
}

/// One row of "My edits".
#[derive(Debug, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct EditRow {
    pub proposal: Proposal,
    /// The English of the entry.
    pub en: String,
    /// The game's Russian now ("was").
    pub ru_game: Option<String>,
    /// The proposal's place's 0-based order in its story, when the line is still there.
    pub ord: Option<i32>,
    /// `proposed`, `approved`, `otherApproved` or `outdated`.
    pub state: String,
    /// Places holding the entry.
    pub places: i32,
}

/// "My edits".
#[derive(Debug, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct EditRows {
    pub all: bool,
    /// Newest first, up to 2,000.
    pub rows: Vec<EditRow>,
}
