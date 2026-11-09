//! HTTP routes of line editing, under `/api/translators`. Members only;
//! one's own proposals and comments only, except what the lead may do.

use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use serde::Serialize;
use ts_rs::TS;
use utoipa::ToSchema;

use super::db::{self, PlaceLine};
use super::dto::{
    AgreementInput, CommentInput, EditPlace, EditRows, EditsQuery, KeyPlaces, ProposalInput,
    ProposalRewrite, ProposalVersion, ResolveInput,
};
use super::status::{self, CONFIRM_PLACES};
use crate::app::error::ApiError;
use crate::app::extractors::auth::MaybeAuthUser;
use crate::app::state::AppState;
use crate::translators::routes::require_member;

/// The id of what was created.
#[derive(Debug, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct EditCreated {
    #[ts(type = "number")]
    pub id: i64,
}

/// The line at a place, or 404; 400 when it has nothing to translate.
async fn editable_place(state: &AppState, place: &EditPlace) -> Result<PlaceLine, ApiError> {
    let line = db::place_line(&state.db, place)
        .await?
        .ok_or(ApiError::NotFound)?;
    if !status::editable(&line.edit_key) {
        return Err(ApiError::BadRequest(
            "this line has nothing to translate".into(),
        ));
    }
    Ok(line)
}

/// 409 when the entry stands in more places than [`CONFIRM_PLACES`] and the
/// caller did not confirm the edit with the list in front of them.
async fn check_many(state: &AppState, key: &str, confirmed: bool) -> Result<(), ApiError> {
    if confirmed {
        return Ok(());
    }
    let n = db::place_counts(&state.db, &[key.to_owned()])
        .await?
        .get(key)
        .copied()
        .unwrap_or(0);
    if n > CONFIRM_PLACES {
        return Err(ApiError::Conflict(format!(
            "the line stands in {n} places: confirm the edit"
        )));
    }
    Ok(())
}

/// The text as stored, or 400; also 400 when it is the game's Russian unchanged.
fn proposal_text(text: &str, ru_game: Option<&str>) -> Result<String, ApiError> {
    let text = status::clean_text(text).ok_or_else(|| {
        ApiError::BadRequest(format!(
            "the text is empty or longer than {} characters",
            status::MAX_TEXT
        ))
    })?;
    if ru_game.and_then(status::clean_text).as_deref() == Some(text.as_str()) {
        return Err(ApiError::BadRequest(
            "the text is the game's Russian: keep it as in the game instead".into(),
        ));
    }
    Ok(text)
}

/// Write the caller's proposal for the line's dictionary entry, or rewrite
/// the one they have (a new version). Members only.
#[utoipa::path(
    post,
    path = "/translators/proposals",
    tag = "translators",
    security(("bearer_auth" = [])),
    request_body = ProposalInput,
    responses(
        (status = 200, description = "The proposal's id.", body = EditCreated),
        (status = 400, response = crate::app::openapi::responses::BadRequest),
        (status = 401, response = crate::app::openapi::responses::Unauthorized),
        (status = 403, response = crate::app::openapi::responses::Forbidden),
        (status = 404, response = crate::app::openapi::responses::NotFound),
        (status = 409, response = crate::app::openapi::responses::Conflict),
        (status = 500, response = crate::app::openapi::responses::InternalError)
    )
)]
pub async fn create_proposal(
    State(state): State<AppState>,
    auth: MaybeAuthUser,
    Json(input): Json<ProposalInput>,
) -> Result<Json<EditCreated>, ApiError> {
    let me = require_member(&state, &auth).await?;
    if !matches!(input.source.as_str(), "own" | "sova" | "ai") {
        return Err(ApiError::BadRequest("source: own, sova or ai".into()));
    }
    let line = editable_place(&state, &input.place).await?;
    let text = proposal_text(&input.text, line.ru_game.as_deref())?;
    check_many(&state, &line.edit_key, input.confirm_many).await?;
    let id = db::upsert_proposal(
        &state.db,
        &line.edit_key,
        &input.place,
        &text,
        &input.source,
        me.id,
    )
    .await?;
    Ok(Json(EditCreated { id }))
}

/// Rewrite one's own proposal (a new version). Members only.
#[utoipa::path(
    put,
    path = "/translators/proposals/{id}",
    tag = "translators",
    security(("bearer_auth" = [])),
    params(("id" = i64, Path, description = "The proposal.")),
    request_body = ProposalRewrite,
    responses(
        (status = 204, description = "Rewritten."),
        (status = 400, response = crate::app::openapi::responses::BadRequest),
        (status = 401, response = crate::app::openapi::responses::Unauthorized),
        (status = 403, response = crate::app::openapi::responses::Forbidden),
        (status = 404, response = crate::app::openapi::responses::NotFound),
        (status = 409, response = crate::app::openapi::responses::Conflict),
        (status = 500, response = crate::app::openapi::responses::InternalError)
    )
)]
pub async fn rewrite_proposal(
    State(state): State<AppState>,
    auth: MaybeAuthUser,
    Path(id): Path<i64>,
    Json(input): Json<ProposalRewrite>,
) -> Result<StatusCode, ApiError> {
    let me = require_member(&state, &auth).await?;
    let (key, author, old, source) = db::proposal_owner(&state.db, id)
        .await?
        .ok_or(ApiError::NotFound)?;
    if author != me.id {
        return Err(ApiError::Forbidden);
    }
    let ru_game = db::key_ru_game(&state.db, &key).await?;
    let text = proposal_text(&input.text, ru_game.as_deref())?;
    if text == old {
        return Ok(StatusCode::NO_CONTENT);
    }
    check_many(&state, &key, input.confirm_many).await?;
    db::rewrite_proposal(&state.db, id, &text, &source, me.id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Delete one's own proposal (kept in the database, gone from the site),
/// with the votes for it. Members only.
#[utoipa::path(
    delete,
    path = "/translators/proposals/{id}",
    tag = "translators",
    security(("bearer_auth" = [])),
    params(("id" = i64, Path, description = "The proposal.")),
    responses(
        (status = 204, description = "Deleted."),
        (status = 401, response = crate::app::openapi::responses::Unauthorized),
        (status = 403, response = crate::app::openapi::responses::Forbidden),
        (status = 404, response = crate::app::openapi::responses::NotFound),
        (status = 500, response = crate::app::openapi::responses::InternalError)
    )
)]
pub async fn delete_proposal(
    State(state): State<AppState>,
    auth: MaybeAuthUser,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    let me = require_member(&state, &auth).await?;
    let (_, author, _, _) = db::proposal_owner(&state.db, id)
        .await?
        .ok_or(ApiError::NotFound)?;
    if author != me.id {
        return Err(ApiError::Forbidden);
    }
    db::delete_proposal(&state.db, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Every text a proposal has had, newest first. Members only.
#[utoipa::path(
    get,
    path = "/translators/proposals/{id}/versions",
    tag = "translators",
    security(("bearer_auth" = [])),
    params(("id" = i64, Path, description = "The proposal.")),
    responses(
        (status = 200, description = "The versions, the current one first.", body = Vec<ProposalVersion>),
        (status = 401, response = crate::app::openapi::responses::Unauthorized),
        (status = 403, response = crate::app::openapi::responses::Forbidden),
        (status = 404, response = crate::app::openapi::responses::NotFound),
        (status = 500, response = crate::app::openapi::responses::InternalError)
    )
)]
pub async fn proposal_versions(
    State(state): State<AppState>,
    auth: MaybeAuthUser,
    Path(id): Path<i64>,
) -> Result<Json<Vec<ProposalVersion>>, ApiError> {
    require_member(&state, &auth).await?;
    db::proposal_owner(&state.db, id)
        .await?
        .ok_or(ApiError::NotFound)?;
    Ok(Json(db::versions(&state.db, id).await?))
}

/// Agree with a variant of the line's entry, or take it back. A null
/// proposal is the game's Russian: "keep as in the game". Members only.
#[utoipa::path(
    put,
    path = "/translators/agreements",
    tag = "translators",
    security(("bearer_auth" = [])),
    request_body = AgreementInput,
    responses(
        (status = 204, description = "Recorded."),
        (status = 400, response = crate::app::openapi::responses::BadRequest),
        (status = 401, response = crate::app::openapi::responses::Unauthorized),
        (status = 403, response = crate::app::openapi::responses::Forbidden),
        (status = 404, response = crate::app::openapi::responses::NotFound),
        (status = 500, response = crate::app::openapi::responses::InternalError)
    )
)]
pub async fn set_agreement(
    State(state): State<AppState>,
    auth: MaybeAuthUser,
    Json(input): Json<AgreementInput>,
) -> Result<StatusCode, ApiError> {
    let me = require_member(&state, &auth).await?;
    let line = editable_place(&state, &input.place).await?;
    if let Some(id) = input.proposal_id {
        let (key, author, _, _) = db::proposal_owner(&state.db, id)
            .await?
            .ok_or(ApiError::NotFound)?;
        if key != line.edit_key {
            return Err(ApiError::BadRequest(
                "the proposal is for another line".into(),
            ));
        }
        if author == me.id {
            return Err(ApiError::BadRequest(
                "one does not agree with one's own proposal".into(),
            ));
        }
    } else if line.ru_game.is_none() {
        return Err(ApiError::BadRequest(
            "the game shows no Russian for this line".into(),
        ));
    }
    db::set_agreement(
        &state.db,
        &line.edit_key,
        input.proposal_id,
        me.id,
        input.agree,
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

/// A note on the line's entry. Members only.
#[utoipa::path(
    post,
    path = "/translators/comments",
    tag = "translators",
    security(("bearer_auth" = [])),
    request_body = CommentInput,
    responses(
        (status = 200, description = "The comment's id.", body = EditCreated),
        (status = 400, response = crate::app::openapi::responses::BadRequest),
        (status = 401, response = crate::app::openapi::responses::Unauthorized),
        (status = 403, response = crate::app::openapi::responses::Forbidden),
        (status = 404, response = crate::app::openapi::responses::NotFound),
        (status = 500, response = crate::app::openapi::responses::InternalError)
    )
)]
pub async fn create_comment(
    State(state): State<AppState>,
    auth: MaybeAuthUser,
    Json(input): Json<CommentInput>,
) -> Result<Json<EditCreated>, ApiError> {
    let me = require_member(&state, &auth).await?;
    let line = db::place_line(&state.db, &input.place)
        .await?
        .ok_or(ApiError::NotFound)?;
    let text = status::clean_text(&input.text).ok_or_else(|| {
        ApiError::BadRequest(format!(
            "the comment is empty or longer than {} characters",
            status::MAX_TEXT
        ))
    })?;
    let id = db::add_comment(&state.db, &line.edit_key, &input.place, &text, me.id).await?;
    Ok(Json(EditCreated { id }))
}

/// Delete one's own comment. Members only.
#[utoipa::path(
    delete,
    path = "/translators/comments/{id}",
    tag = "translators",
    security(("bearer_auth" = [])),
    params(("id" = i64, Path, description = "The comment.")),
    responses(
        (status = 204, description = "Deleted."),
        (status = 401, response = crate::app::openapi::responses::Unauthorized),
        (status = 403, response = crate::app::openapi::responses::Forbidden),
        (status = 404, response = crate::app::openapi::responses::NotFound),
        (status = 500, response = crate::app::openapi::responses::InternalError)
    )
)]
pub async fn delete_comment(
    State(state): State<AppState>,
    auth: MaybeAuthUser,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    let me = require_member(&state, &auth).await?;
    let author = db::comment_author(&state.db, id)
        .await?
        .ok_or(ApiError::NotFound)?;
    if author != me.id {
        return Err(ApiError::Forbidden);
    }
    db::delete_comment(&state.db, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Mark a comment resolved or open again: its author or the lead.
#[utoipa::path(
    put,
    path = "/translators/comments/{id}/resolved",
    tag = "translators",
    security(("bearer_auth" = [])),
    params(("id" = i64, Path, description = "The comment.")),
    request_body = ResolveInput,
    responses(
        (status = 204, description = "Recorded."),
        (status = 401, response = crate::app::openapi::responses::Unauthorized),
        (status = 403, response = crate::app::openapi::responses::Forbidden),
        (status = 404, response = crate::app::openapi::responses::NotFound),
        (status = 500, response = crate::app::openapi::responses::InternalError)
    )
)]
pub async fn resolve_comment(
    State(state): State<AppState>,
    auth: MaybeAuthUser,
    Path(id): Path<i64>,
    Json(input): Json<ResolveInput>,
) -> Result<StatusCode, ApiError> {
    let me = require_member(&state, &auth).await?;
    let author = db::comment_author(&state.db, id)
        .await?
        .ok_or(ApiError::NotFound)?;
    if author != me.id && !me.leads() {
        return Err(ApiError::Forbidden);
    }
    db::resolve_comment(&state.db, id, input.resolved.then_some(me.id)).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Every story line holding the same dictionary entry as the line at a
/// place: an edit there changes them all. Members only.
#[utoipa::path(
    get,
    path = "/translators/places",
    tag = "translators",
    security(("bearer_auth" = [])),
    params(EditPlace),
    responses(
        (status = 200, description = "The entry's places, up to 500.", body = KeyPlaces),
        (status = 401, response = crate::app::openapi::responses::Unauthorized),
        (status = 403, response = crate::app::openapi::responses::Forbidden),
        (status = 404, response = crate::app::openapi::responses::NotFound),
        (status = 500, response = crate::app::openapi::responses::InternalError)
    )
)]
pub async fn places(
    State(state): State<AppState>,
    auth: MaybeAuthUser,
    Query(place): Query<EditPlace>,
) -> Result<Json<KeyPlaces>, ApiError> {
    require_member(&state, &auth).await?;
    let line = db::place_line(&state.db, &place)
        .await?
        .ok_or(ApiError::NotFound)?;
    let total = db::place_counts(&state.db, std::slice::from_ref(&line.edit_key))
        .await?
        .get(&line.edit_key)
        .copied()
        .unwrap_or(0);
    let places = db::places(&state.db, &line.edit_key, 500).await?;
    Ok(Json(KeyPlaces {
        edit_key: line.edit_key,
        total,
        places,
    }))
}

/// "My edits": the caller's proposals, newest first; everyone's for the lead
/// with `all`. Members only.
#[utoipa::path(
    get,
    path = "/translators/edits",
    tag = "translators",
    security(("bearer_auth" = [])),
    params(EditsQuery),
    responses(
        (status = 200, description = "The proposals with what the game shows now and where.", body = EditRows),
        (status = 401, response = crate::app::openapi::responses::Unauthorized),
        (status = 403, response = crate::app::openapi::responses::Forbidden),
        (status = 500, response = crate::app::openapi::responses::InternalError)
    )
)]
pub async fn edits(
    State(state): State<AppState>,
    auth: MaybeAuthUser,
    Query(query): Query<EditsQuery>,
) -> Result<Json<EditRows>, ApiError> {
    let me = require_member(&state, &auth).await?;
    if query.all && !me.leads() {
        return Err(ApiError::Forbidden);
    }
    let rows = db::edit_rows(&state.db, (!query.all).then_some(me.id)).await?;
    Ok(Json(EditRows {
        all: query.all,
        rows,
    }))
}
