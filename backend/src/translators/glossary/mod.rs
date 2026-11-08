//! The team glossary: downloaded from its Google Sheet, kept in the section's
//! tables, matched against the story lines. Read only: the sheet is where the
//! team edits it.

pub mod matcher;
pub mod parse;

use std::sync::atomic::{AtomicBool, Ordering};

use sha2::{Digest, Sha256};
use sqlx::{PgPool, Postgres, QueryBuilder};

use matcher::Finder;
use parse::Term;

/// The team's sheet, as people open it.
pub const SHEET_URL: &str =
    "https://docs.google.com/spreadsheets/d/1GVqVvFctKpuRIdaAY4roMuxVaaNMJ8me2ll3mm47ZpE";

/// Its xlsx export, readable without signing in (`TRANSLATORS_GLOSSARY_URL` overrides).
fn export_url() -> String {
    std::env::var("TRANSLATORS_GLOSSARY_URL")
        .ok()
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_else(|| format!("{SHEET_URL}/export?format=xlsx"))
}

static REFRESHING: AtomicBool = AtomicBool::new(false);

pub fn refreshing() -> bool {
    REFRESHING.load(Ordering::SeqCst)
}

/// Download, parse and store the glossary, then recount it over the story.
/// On any failure the stored copy stays and the error is recorded.
pub async fn refresh(pool: &PgPool, http: &reqwest::Client) -> anyhow::Result<usize> {
    if REFRESHING.swap(true, Ordering::SeqCst) {
        anyhow::bail!("a glossary refresh is already running");
    }
    let result = refresh_inner(pool, http).await;
    REFRESHING.store(false, Ordering::SeqCst);
    if let Err(e) = &result {
        tracing::warn!(error = %e, "glossary refresh failed; keeping the stored copy");
        let _ = sqlx::query(
            "INSERT INTO translators.glossary_meta (id, attempted_at, last_error) VALUES (1, NOW(), $1)
             ON CONFLICT (id) DO UPDATE SET attempted_at = NOW(), last_error = $1",
        )
        .bind(e.to_string())
        .execute(pool)
        .await;
    }
    result
}

async fn refresh_inner(pool: &PgPool, http: &reqwest::Client) -> anyhow::Result<usize> {
    let res = http
        .get(export_url())
        .timeout(std::time::Duration::from_secs(60))
        .send()
        .await?
        .error_for_status()?;
    let bytes = res.bytes().await?;
    let sha = hex::encode(Sha256::digest(&bytes));
    let terms = tokio::task::spawn_blocking(move || parse::parse(&bytes)).await??;
    if terms.is_empty() {
        anyhow::bail!("the downloaded glossary has no terms");
    }
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM translators.glossary_terms")
        .execute(&mut *tx)
        .await?;
    for chunk in terms.chunks(1_000) {
        let mut qb: QueryBuilder<Postgres> = QueryBuilder::new(
            "INSERT INTO translators.glossary_terms (sheet, row_no, en, key, qualifier, ru, ru_plural, note, synonyms, comment, cn, case_sensitive, from_sova) ",
        );
        qb.push_values(chunk, |mut b, t| {
            b.push_bind(&t.sheet)
                .push_bind(i32::try_from(t.row).unwrap_or(0))
                .push_bind(&t.en)
                .push_bind(&t.key)
                .push_bind(&t.qualifier)
                .push_bind(&t.ru)
                .push_bind(&t.ru_plural)
                .push_bind(&t.note)
                .push_bind(&t.synonyms)
                .push_bind(&t.comment)
                .push_bind(&t.cn)
                .push_bind(t.case_sensitive)
                .push_bind(t.from_sova);
        });
        qb.build().execute(&mut *tx).await?;
    }
    sqlx::query(
        "INSERT INTO translators.glossary_meta (id, fetched_at, sha256, attempted_at, last_error) VALUES (1, NOW(), $1, NOW(), NULL)
         ON CONFLICT (id) DO UPDATE SET fetched_at = NOW(), sha256 = $1, attempted_at = NOW(), last_error = NULL",
    )
    .bind(&sha)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    recount(pool).await?;
    tracing::info!(terms = terms.len(), "glossary refreshed");
    Ok(terms.len())
}

#[derive(sqlx::FromRow)]
pub struct StoredTerm {
    pub id: i32,
    pub sheet: String,
    pub row_no: i32,
    pub en: String,
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
    pub story_lines: i32,
}

impl StoredTerm {
    pub fn as_term(&self) -> Term {
        Term {
            sheet: self.sheet.clone(),
            row: u32::try_from(self.row_no).unwrap_or(0),
            en: self.en.clone(),
            key: self.key.clone(),
            qualifier: self.qualifier.clone(),
            ru: self.ru.clone(),
            ru_plural: self.ru_plural.clone(),
            note: self.note.clone(),
            synonyms: self.synonyms.clone(),
            comment: self.comment.clone(),
            cn: self.cn.clone(),
            case_sensitive: self.case_sensitive,
            from_sova: self.from_sova,
        }
    }
}

pub async fn load(pool: &PgPool) -> Result<Vec<StoredTerm>, sqlx::Error> {
    sqlx::query_as("SELECT * FROM translators.glossary_terms ORDER BY id")
        .fetch_all(pool)
        .await
}

/// `(fetched_at, attempted_at, last_error)` of the stored glossary.
pub async fn meta(
    pool: &PgPool,
) -> Result<
    Option<(
        Option<chrono::DateTime<chrono::Utc>>,
        Option<chrono::DateTime<chrono::Utc>>,
        Option<String>,
    )>,
    sqlx::Error,
> {
    sqlx::query_as(
        "SELECT fetched_at, attempted_at, last_error FROM translators.glossary_meta WHERE id = 1",
    )
    .fetch_optional(pool)
    .await
}

/// Count, for every term, the story lines whose English holds its key.
pub async fn recount(pool: &PgPool) -> anyhow::Result<()> {
    let stored = load(pool).await?;
    if stored.is_empty() {
        return Ok(());
    }
    let lines: Vec<String> = sqlx::query_scalar("SELECT en FROM translators.story_lines")
        .fetch_all(pool)
        .await?;
    let ids: Vec<i32> = stored.iter().map(|s| s.id).collect();
    let counts = tokio::task::spawn_blocking(move || {
        let terms: Vec<Term> = stored.iter().map(StoredTerm::as_term).collect();
        let finder = Finder::new(&terms);
        let mut counts = vec![0_i32; terms.len()];
        for en in &lines {
            let mut seen = std::collections::HashSet::new();
            for f in finder.find(en) {
                for t in f.terms {
                    if seen.insert(t) {
                        counts[t] += 1;
                    }
                }
            }
        }
        counts
    })
    .await?;
    sqlx::query(
        "UPDATE translators.glossary_terms g SET story_lines = c.n
         FROM UNNEST($1::int[], $2::int[]) AS c(id, n) WHERE g.id = c.id",
    )
    .bind(&ids)
    .bind(&counts)
    .execute(pool)
    .await?;
    Ok(())
}
