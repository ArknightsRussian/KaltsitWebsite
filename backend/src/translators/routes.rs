//! HTTP routes of the translators' section, under `/api/translators`.

use axum::Json;
use axum::extract::{Path, State};
use uuid::Uuid;

use super::dto::{TranslatorStoryLines, TranslatorsMe};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

use super::dto::ImportStatus;
use super::import::{self, Sources};
use super::{SERVER, db, dev_login_enabled};
use crate::app::error::ApiError;
use crate::app::extractors::auth::{AuthUser, MaybeAuthUser};
use crate::app::services::auth::LoginResponse;
use crate::app::services::story::cached_index;
use crate::app::state::AppState;
use crate::core::auth::jwt::create_token;
use crate::core::hypergryph::constants::Server;
use crate::database::queries::users::{create_user, find_raw_by_uid};

/// The uid of the development account. Real Arknights uids are digits only.
const DEV_UID: &str = "dev-translator";

async fn member_of(state: &AppState, auth: &MaybeAuthUser) -> Result<bool, ApiError> {
    let Some(user) = &auth.0 else {
        return Ok(false);
    };
    let Ok(id) = user.user_id.parse::<Uuid>() else {
        return Ok(false);
    };
    Ok(db::is_member(&state.db, id).await?)
}

/// Whether the caller is a signed-in translator, and whether the development sign-in is on.
#[utoipa::path(
    get,
    path = "/translators/me",
    tag = "translators",
    security(("bearer_auth" = []), ()),
    responses(
        (status = 200, description = "The caller's standing in the section.", body = TranslatorsMe),
        (status = 500, response = crate::app::openapi::responses::InternalError)
    )
)]
pub async fn me(
    State(state): State<AppState>,
    auth: MaybeAuthUser,
) -> Result<Json<TranslatorsMe>, ApiError> {
    Ok(Json(TranslatorsMe {
        member: member_of(&state, &auth).await?,
        dev_login: dev_login_enabled(),
    }))
}

/// One story's lines: English, the Russian the game shows now, Chinese, and
/// for signed-in translators Sova's and the AI's texts.
#[utoipa::path(
    get,
    path = "/translators/stories/{story_id}/lines",
    tag = "translators",
    security(("bearer_auth" = []), ()),
    params(("story_id" = String, Path, description = "The story id, as in `/story/{id}`.")),
    responses(
        (status = 200, description = "The story's lines in file order; empty when nothing was imported.", body = TranslatorStoryLines),
        (status = 429, response = crate::app::openapi::responses::RateLimited),
        (status = 500, response = crate::app::openapi::responses::InternalError)
    )
)]
pub async fn story_lines(
    State(state): State<AppState>,
    auth: MaybeAuthUser,
    Path(story_id): Path<String>,
) -> Result<Json<TranslatorStoryLines>, ApiError> {
    let hints = member_of(&state, &auth).await?;
    let lines = db::story_lines(&state.db, SERVER, &story_id, hints).await?;
    let imported_at = db::last_import(&state.db, SERVER)
        .await?
        .map(|t| t.timestamp());
    Ok(Json(TranslatorStoryLines {
        story_id,
        imported_at,
        hints,
        lines,
    }))
}

/// Start rebuilding the section's lines from the EN scripts, the ArknightsRU
/// dictionaries and arktr, in the background (it outlasts the request
/// timeout). Internal service key only; re-runnable. Poll `GET` for the result.
#[utoipa::path(
    post,
    path = "/translators/import",
    tag = "translators",
    security(("service_key" = [])),
    responses(
        (status = 200, description = "The import's state right after the request: running, with the previous result.", body = ImportStatus),
        (status = 400, response = crate::app::openapi::responses::BadRequest),
        (status = 401, response = crate::app::openapi::responses::Unauthorized),
        (status = 403, response = crate::app::openapi::responses::Forbidden),
        (status = 500, response = crate::app::openapi::responses::InternalError)
    )
)]
pub async fn run_import(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<ImportStatus>, ApiError> {
    if auth.user_id != "service" {
        return Err(ApiError::Forbidden);
    }
    let sources = Sources::from_env().map_err(ApiError::BadRequest)?;
    if !IMPORT_RUNNING.swap(true, Ordering::SeqCst) {
        *lock_error() = None;
        let state2 = state.clone();
        tokio::spawn(async move {
            let result = import_now(&state2, sources).await;
            if let Err(e) = &result {
                tracing::error!(error = %e, "translators import failed");
                *lock_error() = Some(e.to_string());
            }
            IMPORT_RUNNING.store(false, Ordering::SeqCst);
        });
    }
    import_status(State(state), auth).await
}

/// Whether an import is running, the last error, and the last finished import's summary.
#[utoipa::path(
    get,
    path = "/translators/import",
    tag = "translators",
    security(("service_key" = [])),
    responses(
        (status = 200, description = "The import's state.", body = ImportStatus),
        (status = 401, response = crate::app::openapi::responses::Unauthorized),
        (status = 403, response = crate::app::openapi::responses::Forbidden),
        (status = 500, response = crate::app::openapi::responses::InternalError)
    )
)]
pub async fn import_status(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<ImportStatus>, ApiError> {
    if auth.user_id != "service" {
        return Err(ApiError::Forbidden);
    }
    let last = db::last_import_summary(&state.db, SERVER).await?;
    Ok(Json(ImportStatus {
        running: IMPORT_RUNNING.load(Ordering::SeqCst),
        error: lock_error().clone(),
        last_finished_at: last.as_ref().map(|(t, _)| t.timestamp()),
        last: last.map(|(_, s)| s),
    }))
}

static IMPORT_RUNNING: AtomicBool = AtomicBool::new(false);
static IMPORT_ERROR: Mutex<Option<String>> = Mutex::new(None);

fn lock_error() -> std::sync::MutexGuard<'static, Option<String>> {
    IMPORT_ERROR
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

async fn import_now(state: &AppState, sources: Sources) -> Result<(), ApiError> {
    let started_at = chrono::Utc::now();
    let index = cached_index(state, Server::EN).await?;
    let server_data = state
        .try_server_data(Server::EN)
        .ok_or(ApiError::ServiceUnavailable)?;
    let assets_dir = std::path::PathBuf::from(&server_data.assets_dir);
    let mut stories: Vec<_> = index
        .lookup
        .iter()
        .map(|(id, r)| (id.clone(), r.clone()))
        .collect();
    stories.sort_by(|a, b| a.0.cmp(&b.0));
    let (lines, summary) =
        tokio::task::spawn_blocking(move || import::build(&sources, &assets_dir, &stories))
            .await
            .map_err(|e| ApiError::Internal(e.into()))??;
    import::store(&state.db, SERVER, started_at, &lines, &summary).await?;
    tracing::info!(
        lines = summary.lines,
        with_ru = summary.with_ru_game,
        "translators import done"
    );
    Ok(())
}

/// Development only: sign in as a local translator account without a game
/// account. Answers 404 unless `TRANSLATORS_DEV_LOGIN=1` is set for the
/// backend process.
#[utoipa::path(
    post,
    path = "/translators/dev-login",
    tag = "translators",
    responses(
        (status = 200, description = "A site token for the development translator.", body = LoginResponse),
        (status = 404, response = crate::app::openapi::responses::NotFound),
        (status = 500, response = crate::app::openapi::responses::InternalError)
    )
)]
pub async fn dev_login(State(state): State<AppState>) -> Result<Json<LoginResponse>, ApiError> {
    if !dev_login_enabled() {
        return Err(ApiError::NotFound);
    }
    let server = Server::EN;
    let server_id = server.index() as i16;
    let user = match find_raw_by_uid(&state.db, DEV_UID, server_id).await? {
        Some(u) => u,
        None => create_user(&state.db, DEV_UID, server_id).await?,
    };
    db::add_member(&state.db, user.id, "development sign-in").await?;
    let token = create_token(
        &state.config.jwt_secret,
        &user.id.to_string(),
        DEV_UID,
        server.as_str(),
        &user.role,
        7,
    )
    .map_err(|e| ApiError::Internal(e.into()))?;
    tracing::warn!("translators development sign-in used");
    Ok(Json(LoginResponse {
        token,
        uid: DEV_UID.to_owned(),
        server: server.as_str().to_owned(),
    }))
}
