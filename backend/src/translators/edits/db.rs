//! Queries of line editing (schema `translators`, migration t003).

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::dto::{
    Approval, EditComment, EditPerson, EditPlace, EditRow, KeyEdits, KeyPlace, OutdatedEdit,
    Proposal, ProposalVersion,
};
use super::status;
use crate::translators::SERVER;

/// How a member's name shows: the game nickname, else the uid.
const NAME: &str = "COALESCE(NULLIF(u.nickname, ''), u.uid)";

fn person(id: Uuid, name: String) -> EditPerson {
    EditPerson {
        id: id.to_string(),
        name,
    }
}

/// The line at a place: its edit key, English and the game's Russian.
pub struct PlaceLine {
    pub edit_key: String,
    pub ru_game: Option<String>,
    pub sova: Option<String>,
    pub ai: Option<String>,
}

pub async fn place_line(pool: &PgPool, p: &EditPlace) -> Result<Option<PlaceLine>, sqlx::Error> {
    #[allow(clippy::type_complexity)]
    let row: Option<(String, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT edit_key, ru_game, sova, ai FROM translators.story_lines
         WHERE server = $1 AND story_id = $2 AND line = $3 AND part = $4",
    )
    .bind(SERVER)
    .bind(&p.story_id)
    .bind(p.line)
    .bind(p.part)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|(edit_key, ru_game, sova, ai)| PlaceLine {
        edit_key,
        ru_game,
        sova,
        ai,
    }))
}

/// The game's Russian for a key (the same at every place).
pub async fn key_ru_game(pool: &PgPool, key: &str) -> Result<Option<String>, sqlx::Error> {
    let row: Option<Option<String>> = sqlx::query_scalar(
        "SELECT ru_game FROM translators.story_lines WHERE server = $1 AND edit_key = $2 LIMIT 1",
    )
    .bind(SERVER)
    .bind(key)
    .fetch_optional(pool)
    .await?;
    Ok(row.flatten())
}

/// How many story lines hold each key.
pub async fn place_counts(
    pool: &PgPool,
    keys: &[String],
) -> Result<HashMap<String, i32>, sqlx::Error> {
    let rows: Vec<(String, i64)> = sqlx::query_as(
        "SELECT edit_key, COUNT(*) FROM translators.story_lines
         WHERE server = $1 AND edit_key = ANY($2) GROUP BY edit_key",
    )
    .bind(SERVER)
    .bind(keys)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(k, n)| (k, i32::try_from(n).unwrap_or(i32::MAX)))
        .collect())
}

pub async fn places(pool: &PgPool, key: &str, limit: i64) -> Result<Vec<KeyPlace>, sqlx::Error> {
    #[allow(clippy::type_complexity)]
    let rows: Vec<(String, i32, i16, i32, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT s.story_id, s.line, s.part, s.ord,
                COALESCE(b.ru_game, b.en), COALESCE(a.ru_game, a.en)
         FROM translators.story_lines s
         LEFT JOIN translators.story_lines b
             ON b.server = s.server AND b.story_id = s.story_id AND b.ord = s.ord - 1
         LEFT JOIN translators.story_lines a
             ON a.server = s.server AND a.story_id = s.story_id AND a.ord = s.ord + 1
         WHERE s.server = $1 AND s.edit_key = $2 ORDER BY s.story_id, s.ord LIMIT $3",
    )
    .bind(SERVER)
    .bind(key)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(story_id, line, part, ord, before, after)| KeyPlace {
            story_id,
            line,
            part,
            ord,
            before,
            after,
        })
        .collect())
}

#[derive(sqlx::FromRow)]
struct ProposalRow {
    id: i64,
    edit_key: String,
    text: String,
    source: String,
    author_id: Uuid,
    author_name: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    story_id: String,
    line: i32,
    part: i16,
    outdated_at: Option<DateTime<Utc>>,
    context: bool,
    versions: i64,
}

const PROPOSAL_COLUMNS: &str = "p.id, p.edit_key, p.text, p.source, p.author_id, \
     COALESCE(NULLIF(u.nickname, ''), u.uid) AS author_name, p.created_at, p.updated_at, \
     p.story_id, p.line, p.part, p.outdated_at, p.context, \
     (SELECT COUNT(*) FROM translators.proposal_versions v WHERE v.proposal_id = p.id) AS versions";

impl ProposalRow {
    fn into_proposal(self, agreements: Vec<EditPerson>) -> Proposal {
        // A rewrite moves `updated_at`; the first save sets both at once.
        let edited = self.versions > 1;
        Proposal {
            id: self.id,
            edit_key: self.edit_key,
            text: self.text,
            source: self.source,
            author: person(self.author_id, self.author_name),
            created_at: self.created_at.timestamp(),
            edited_at: edited.then(|| self.updated_at.timestamp()),
            versions: i32::try_from(self.versions).unwrap_or(i32::MAX),
            agreements,
            place: EditPlace {
                story_id: self.story_id,
                line: self.line,
                part: self.part,
            },
            context: self.context,
            outdated: self.outdated_at.is_some(),
        }
    }
}

/// Who agrees with what, for the keys: `(key, proposal or None) -> people`.
type Votes = HashMap<(String, Option<i64>), Vec<EditPerson>>;

async fn votes(pool: &PgPool, keys: &[String]) -> Result<Votes, sqlx::Error> {
    let rows: Vec<(String, Option<i64>, Uuid, String)> = sqlx::query_as(&format!(
        "SELECT a.edit_key, a.proposal_id, a.user_id, {NAME}
         FROM translators.agreements a JOIN users u ON u.id = a.user_id
         WHERE a.edit_key = ANY($1) ORDER BY a.created_at"
    ))
    .bind(keys)
    .fetch_all(pool)
    .await?;
    let mut out: Votes = HashMap::new();
    for (key, proposal, id, name) in rows {
        out.entry((key, proposal))
            .or_default()
            .push(person(id, name));
    }
    Ok(out)
}

fn entry<'m>(out: &'m mut HashMap<String, KeyEdits>, key: &str) -> &'m mut KeyEdits {
    out.entry(key.to_owned()).or_insert_with(|| KeyEdits {
        edit_key: key.to_owned(),
        approval: None,
        game_agreements: Vec::new(),
        proposals: Vec::new(),
        comments: Vec::new(),
    })
}

/// Everything proposed, approved and said for the keys (one entry per key
/// that has anything).
pub async fn key_edits(pool: &PgPool, keys: &[String]) -> Result<Vec<KeyEdits>, sqlx::Error> {
    if keys.is_empty() {
        return Ok(Vec::new());
    }
    let mut votes = votes(pool, keys).await?;
    let proposals: Vec<ProposalRow> = sqlx::query_as(&format!(
        "SELECT {PROPOSAL_COLUMNS} FROM translators.proposals p JOIN users u ON u.id = p.author_id
         WHERE p.deleted_at IS NULL AND p.edit_key = ANY($1) ORDER BY p.created_at"
    ))
    .bind(keys)
    .fetch_all(pool)
    .await?;
    #[allow(clippy::type_complexity)]
    let approvals: Vec<(String, Option<i64>, String, Uuid, String, DateTime<Utc>)> =
        sqlx::query_as(&format!(
            "SELECT a.edit_key, a.proposal_id, a.text, a.approved_by, {NAME}, a.approved_at
             FROM translators.approvals a JOIN users u ON u.id = a.approved_by
             WHERE a.edit_key = ANY($1)"
        ))
        .bind(keys)
        .fetch_all(pool)
        .await?;
    let comments = comments(pool, keys).await?;

    let mut out: HashMap<String, KeyEdits> = HashMap::new();
    for ((key, proposal), people) in &votes {
        if proposal.is_none() {
            entry(&mut out, key).game_agreements.clone_from(people);
        }
    }
    for p in proposals {
        let agreed = votes
            .remove(&(p.edit_key.clone(), Some(p.id)))
            .unwrap_or_default();
        let key = p.edit_key.clone();
        entry(&mut out, &key)
            .proposals
            .push(p.into_proposal(agreed));
    }
    for (key, proposal_id, text, by, name, at) in approvals {
        entry(&mut out, &key).approval = Some(Approval {
            proposal_id,
            text,
            by: person(by, name),
            at: at.timestamp(),
        });
    }
    for (key, c) in comments {
        entry(&mut out, &key).comments.push(c);
    }
    let mut out: Vec<KeyEdits> = out.into_values().collect();
    for e in &mut out {
        // Most agreed first; ties by age (the vector is oldest first, the sort is stable).
        e.proposals
            .sort_by_key(|p| std::cmp::Reverse(p.agreements.len()));
    }
    Ok(out)
}

#[derive(sqlx::FromRow)]
struct CommentRow {
    id: i64,
    edit_key: String,
    text: String,
    author_id: Uuid,
    author_name: String,
    created_at: DateTime<Utc>,
    resolved_by: Option<Uuid>,
    resolver_name: Option<String>,
    resolved_at: Option<DateTime<Utc>>,
    story_id: String,
    line: i32,
    part: i16,
    quote: Option<String>,
    kind: String,
    variant: Option<String>,
    proposal_id: Option<i64>,
    variant_text: Option<String>,
}

async fn comments(
    pool: &PgPool,
    keys: &[String],
) -> Result<Vec<(String, EditComment)>, sqlx::Error> {
    let rows: Vec<CommentRow> = sqlx::query_as(&format!(
        "SELECT c.id, c.edit_key, c.text, c.author_id, {NAME} AS author_name, c.created_at,
                c.resolved_by, COALESCE(NULLIF(r.nickname, ''), r.uid) AS resolver_name, c.resolved_at,
                c.story_id, c.line, c.part, c.quote, c.kind, c.variant, c.proposal_id, c.variant_text
         FROM translators.comments c JOIN users u ON u.id = c.author_id
         LEFT JOIN users r ON r.id = c.resolved_by
         WHERE c.deleted_at IS NULL AND c.edit_key = ANY($1) ORDER BY c.created_at"
    ))
    .bind(keys)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|c| {
            (
                c.edit_key,
                EditComment {
                    id: c.id,
                    text: c.text,
                    author: person(c.author_id, c.author_name),
                    created_at: c.created_at.timestamp(),
                    resolved_by: c
                        .resolved_by
                        .map(|i| person(i, c.resolver_name.unwrap_or_default())),
                    resolved_at: c.resolved_at.map(|t| t.timestamp()),
                    place: EditPlace {
                        story_id: c.story_id,
                        line: c.line,
                        part: c.part,
                    },
                    quote: c.quote,
                    kind: c.kind,
                    variant: c.variant,
                    proposal_id: c.proposal_id,
                    variant_text: c.variant_text,
                },
            )
        })
        .collect())
}

/// Approvals and proposals left in a story at places whose English changed.
pub async fn outdated_in_story(
    pool: &PgPool,
    story_id: &str,
) -> Result<Vec<OutdatedEdit>, sqlx::Error> {
    #[allow(clippy::type_complexity)]
    let rows: Vec<(String, i32, i16, String, String, Uuid, String, DateTime<Utc>)> =
        sqlx::query_as(&format!(
            "SELECT 'proposal', p.line, p.part, p.edit_key, p.text, p.author_id, {NAME}, p.updated_at
             FROM translators.proposals p JOIN users u ON u.id = p.author_id
             WHERE p.story_id = $1 AND p.deleted_at IS NULL AND p.outdated_at IS NOT NULL
             UNION ALL
             SELECT 'approval', a.line, a.part, a.edit_key, a.text, a.approved_by, {NAME}, a.approved_at
             FROM translators.approvals a JOIN users u ON u.id = a.approved_by
             WHERE a.story_id = $1 AND a.outdated_at IS NOT NULL"
        ))
        .bind(story_id)
        .fetch_all(pool)
        .await?;
    Ok(rows
        .into_iter()
        .map(
            |(kind, line, part, edit_key, text, id, name, at)| OutdatedEdit {
                kind,
                line,
                part,
                edit_key,
                text,
                author: person(id, name),
                at: at.timestamp(),
            },
        )
        .collect())
}

/// The caller's live proposal for a key in a scope (every place, or this
/// place only), if any: `(id, text, source)`.
async fn my_proposal(
    tx: &mut Transaction<'_, Postgres>,
    key: &str,
    author: Uuid,
    context: Option<&EditPlace>,
) -> Result<Option<(i64, String, String)>, sqlx::Error> {
    sqlx::query_as(
        "SELECT id, text, source FROM translators.proposals
         WHERE edit_key = $1 AND author_id = $2 AND deleted_at IS NULL
           AND context = $3
           AND (NOT $3 OR (story_id = $4 AND line = $5 AND part = $6))
         FOR UPDATE",
    )
    .bind(key)
    .bind(author)
    .bind(context.is_some())
    .bind(context.map(|p| p.story_id.as_str()))
    .bind(context.map(|p| p.line))
    .bind(context.map(|p| p.part))
    .fetch_optional(&mut **tx)
    .await
}

async fn add_version(
    tx: &mut Transaction<'_, Postgres>,
    id: i64,
    text: &str,
    source: &str,
    author: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO translators.proposal_versions (proposal_id, text, source, author_id) VALUES ($1, $2, $3, $4)",
    )
    .bind(id)
    .bind(text)
    .bind(source)
    .bind(author)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Write the caller's proposal for the key (for every place, or for this
/// place only when `context`), or rewrite the one they have in that scope (a
/// new version; the place moves to where it was rewritten). Returns its id.
#[allow(clippy::too_many_arguments)]
pub async fn upsert_proposal(
    pool: &PgPool,
    key: &str,
    place: &EditPlace,
    text: &str,
    source: &str,
    context: bool,
    author: Uuid,
) -> Result<i64, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let mine = my_proposal(&mut tx, key, author, context.then_some(place)).await?;
    let id = if let Some((id, old_text, old_source)) = mine {
        if old_text != text || old_source != source {
            sqlx::query(
                "UPDATE translators.proposals SET text = $2, source = $3, updated_at = NOW(),
                        story_id = $4, line = $5, part = $6
                 WHERE id = $1",
            )
            .bind(id)
            .bind(text)
            .bind(source)
            .bind(&place.story_id)
            .bind(place.line)
            .bind(place.part)
            .execute(&mut *tx)
            .await?;
            add_version(&mut tx, id, text, source, author).await?;
        }
        id
    } else {
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO translators.proposals (edit_key, text, source, author_id, story_id, line, part, context)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
        )
        .bind(key)
        .bind(text)
        .bind(source)
        .bind(author)
        .bind(&place.story_id)
        .bind(place.line)
        .bind(place.part)
        .bind(context)
        .fetch_one(&mut *tx)
        .await?;
        add_version(&mut tx, id, text, source, author).await?;
        id
    };
    tx.commit().await?;
    Ok(id)
}

/// A live proposal: its key, author, text, source and whether it is for one place only.
pub async fn proposal_owner(
    pool: &PgPool,
    id: i64,
) -> Result<Option<(String, Uuid, String, String, bool)>, sqlx::Error> {
    sqlx::query_as(
        "SELECT edit_key, author_id, text, source, context FROM translators.proposals WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

/// Rewrite a proposal (the caller checked it is theirs).
pub async fn rewrite_proposal(
    pool: &PgPool,
    id: i64,
    text: &str,
    source: &str,
    author: Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    sqlx::query("UPDATE translators.proposals SET text = $2, updated_at = NOW() WHERE id = $1")
        .bind(id)
        .bind(text)
        .execute(&mut *tx)
        .await?;
    add_version(&mut tx, id, text, source, author).await?;
    tx.commit().await
}

/// Soft-delete a proposal and drop the votes for it.
pub async fn delete_proposal(pool: &PgPool, id: i64) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    sqlx::query("UPDATE translators.proposals SET deleted_at = NOW() WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM translators.agreements WHERE proposal_id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await
}

pub async fn versions(pool: &PgPool, id: i64) -> Result<Vec<ProposalVersion>, sqlx::Error> {
    let rows: Vec<(i64, String, String, Uuid, String, DateTime<Utc>)> = sqlx::query_as(&format!(
        "SELECT v.id, v.text, v.source, v.author_id, {NAME}, v.created_at
         FROM translators.proposal_versions v JOIN users u ON u.id = v.author_id
         WHERE v.proposal_id = $1 ORDER BY v.id DESC"
    ))
    .bind(id)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(vid, text, source, id, name, at)| ProposalVersion {
            id: vid,
            text,
            source,
            author: person(id, name),
            created_at: at.timestamp(),
        })
        .collect())
}

pub async fn set_agreement(
    pool: &PgPool,
    key: &str,
    proposal: Option<i64>,
    user: Uuid,
    agree: bool,
) -> Result<(), sqlx::Error> {
    if agree {
        sqlx::query(
            "INSERT INTO translators.agreements (edit_key, proposal_id, user_id) VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING",
        )
        .bind(key)
        .bind(proposal)
        .bind(user)
        .execute(pool)
        .await?;
    } else {
        sqlx::query(
            "DELETE FROM translators.agreements
             WHERE edit_key = $1 AND proposal_id IS NOT DISTINCT FROM $2 AND user_id = $3",
        )
        .bind(key)
        .bind(proposal)
        .bind(user)
        .execute(pool)
        .await?;
    }
    Ok(())
}

/// What a new comment or note is: its kind and, for a note on one variant,
/// which one and its text as it is now.
pub struct NewComment<'a> {
    pub text: &'a str,
    pub quote: Option<&'a str>,
    pub kind: &'a str,
    pub variant: Option<&'a str>,
    pub proposal_id: Option<i64>,
    pub variant_text: Option<&'a str>,
}

pub async fn add_comment(
    pool: &PgPool,
    key: &str,
    place: &EditPlace,
    c: &NewComment<'_>,
    author: Uuid,
) -> Result<i64, sqlx::Error> {
    let text = c.text;
    let quote = c.quote;
    sqlx::query_scalar(
        "INSERT INTO translators.comments
             (edit_key, text, author_id, story_id, line, part, quote, kind, variant, proposal_id, variant_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id",
    )
    .bind(key)
    .bind(text)
    .bind(author)
    .bind(&place.story_id)
    .bind(place.line)
    .bind(place.part)
    .bind(quote)
    .bind(c.kind)
    .bind(c.variant)
    .bind(c.proposal_id)
    .bind(c.variant_text)
    .fetch_one(pool)
    .await
}

/// A live comment's author and kind.
pub async fn comment_author(pool: &PgPool, id: i64) -> Result<Option<(Uuid, String)>, sqlx::Error> {
    sqlx::query_as(
        "SELECT author_id, kind FROM translators.comments WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn delete_comment(pool: &PgPool, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE translators.comments SET deleted_at = NOW() WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn resolve_comment(pool: &PgPool, id: i64, by: Option<Uuid>) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE translators.comments SET resolved_by = $2, resolved_at = CASE WHEN $2::uuid IS NULL THEN NULL ELSE NOW() END
         WHERE id = $1",
    )
    .bind(id)
    .bind(by)
    .execute(pool)
    .await?;
    Ok(())
}

#[derive(sqlx::FromRow)]
struct EditRowDb {
    #[sqlx(flatten)]
    p: ProposalRow,
    en: Option<String>,
    ru_game: Option<String>,
    ord: Option<i32>,
    places: i64,
    approved: bool,
    approved_proposal: Option<i64>,
}

/// "My edits": the caller's live proposals (or everyone's), newest first.
pub async fn edit_rows(pool: &PgPool, author: Option<Uuid>) -> Result<Vec<EditRow>, sqlx::Error> {
    let rows: Vec<EditRowDb> = sqlx::query_as(&format!(
        "SELECT {PROPOSAL_COLUMNS},
                k.en, k.ru_game, here.ord,
                (SELECT COUNT(*) FROM translators.story_lines s
                  WHERE s.server = $1 AND s.edit_key = p.edit_key) AS places,
                (a.edit_key IS NOT NULL) AS approved, a.proposal_id AS approved_proposal
         FROM translators.proposals p
         JOIN users u ON u.id = p.author_id
         LEFT JOIN LATERAL (
             SELECT s.en, s.ru_game FROM translators.story_lines s
             WHERE s.server = $1 AND s.edit_key = p.edit_key
             ORDER BY (s.story_id = p.story_id AND s.line = p.line AND s.part = p.part) DESC
             LIMIT 1
         ) k ON TRUE
         LEFT JOIN translators.story_lines here
             ON here.server = $1 AND here.story_id = p.story_id AND here.line = p.line
            AND here.part = p.part
         LEFT JOIN translators.approvals a ON a.edit_key = p.edit_key
         WHERE p.deleted_at IS NULL AND ($2::uuid IS NULL OR p.author_id = $2)
         ORDER BY p.updated_at DESC
         LIMIT 2000"
    ))
    .bind(SERVER)
    .bind(author)
    .fetch_all(pool)
    .await?;
    let keys: Vec<String> = rows.iter().map(|r| r.p.edit_key.clone()).collect();
    let mut votes = votes(pool, &keys).await?;
    Ok(rows
        .into_iter()
        .map(|r| {
            let id = r.p.id;
            let outdated = r.p.outdated_at.is_some();
            let approved = r.approved.then_some(r.approved_proposal);
            let en = r.en.unwrap_or_else(|| r.p.edit_key.clone());
            let agreed = votes
                .remove(&(r.p.edit_key.clone(), Some(id)))
                .unwrap_or_default();
            EditRow {
                proposal: r.p.into_proposal(agreed),
                en,
                ru_game: r.ru_game,
                ord: r.ord,
                state: status::proposal_state(outdated, approved, id).to_owned(),
                places: i32::try_from(r.places).unwrap_or(i32::MAX),
            }
        })
        .collect())
}

/// After an import: mark what is keyed by an English the story no longer
/// has, and clear the mark where it came back.
pub async fn mark_outdated(pool: &PgPool) -> Result<(), sqlx::Error> {
    for table in ["proposals", "approvals", "comments"] {
        sqlx::query(&format!(
            "UPDATE translators.{table} t SET outdated_at = CASE
                 WHEN EXISTS (SELECT 1 FROM translators.story_lines s
                              WHERE s.server = $1 AND s.edit_key = t.edit_key)
                 THEN NULL ELSE COALESCE(t.outdated_at, NOW()) END"
        ))
        .bind(SERVER)
        .execute(pool)
        .await?;
    }
    Ok(())
}

/// Every named story sprite.
pub async fn char_names(pool: &PgPool) -> Result<Vec<super::dto::CharName>, sqlx::Error> {
    sqlx::query_as("SELECT char_id, name_en, name_ru FROM translators.char_names ORDER BY char_id")
        .fetch_all(pool)
        .await
}

/// Sova's notes to a story's chapter, in order.
pub async fn sova_notes(pool: &PgPool, story_id: &str) -> Result<Vec<String>, sqlx::Error> {
    sqlx::query_scalar("SELECT text FROM translators.sova_notes WHERE story_id = $1 ORDER BY idx")
        .bind(story_id)
        .fetch_all(pool)
        .await
}
