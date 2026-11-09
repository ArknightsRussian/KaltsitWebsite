//! The import: every EN story's displayed texts, with the Russian the game
//! shows now (ArknightsRU dictionaries + RichTextFix catalog) and the hints
//! from arktr (Sova, AI, CN), written to `translators.story_lines`.
//!
//! Re-runnable: the server's rows are replaced in one transaction, and the
//! source files are only read. Sources are named by environment variables so
//! that no machine path is committed:
//!
//! * `TRANSLATORS_RU_TEXT_DIR`: the `BepInEx/Translation/ru/Text` folder (required);
//! * `TRANSLATORS_PLUGIN_DLL`: `ArknightsLocalization.RichTextFix.dll` (optional);
//! * `TRANSLATORS_ARKTR_DIR`: the arktr checkout, read at `data/out` (optional).

pub mod arktr;
pub mod lines;
pub mod normalize;
pub mod plugin;
pub mod xunity;

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use serde::Serialize;
use sqlx::{PgPool, Postgres, QueryBuilder};
use utoipa::ToSchema;

use crate::app::services::story::StoryRef;
use lines::{Line, Matcher};

/// Where the sources are, from the environment.
#[derive(Debug, Clone)]
pub struct Sources {
    pub ru_text_dir: PathBuf,
    pub plugin_dll: Option<PathBuf>,
    pub arktr_dir: Option<PathBuf>,
}

impl Sources {
    pub fn from_env() -> Result<Self, String> {
        let get = |k: &str| {
            std::env::var(k)
                .ok()
                .filter(|v| !v.trim().is_empty())
                .map(PathBuf::from)
        };
        let ru_text_dir =
            get("TRANSLATORS_RU_TEXT_DIR").ok_or("TRANSLATORS_RU_TEXT_DIR is not set")?;
        Ok(Self {
            ru_text_dir,
            plugin_dll: get("TRANSLATORS_PLUGIN_DLL"),
            arktr_dir: get("TRANSLATORS_ARKTR_DIR"),
        })
    }
}

/// One example of a text that found no match.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Unmatched {
    pub story_id: String,
    pub line: u32,
    pub en: String,
}

/// What an import read and attached.
#[derive(Debug, Clone, Default, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    pub server: String,
    pub stories: usize,
    /// Stories listed by the library whose script file is missing.
    pub stories_without_script: usize,
    pub lines: usize,
    pub with_ru_game: usize,
    /// How the Russian was found: `exact`, `normalized`, `lines`, `plugin`.
    pub ru_game_by_match: HashMap<String, usize>,
    /// Lines whose text is in the plugin's `story` catalog (edits through the dictionaries may not show).
    pub plugin_story: usize,
    /// Lines the plugin deliberately leaves in English (`ambiguous:story`).
    pub plugin_ambiguous: usize,
    pub without_ru_game: usize,
    pub without_ru_game_examples: Vec<Unmatched>,
    pub with_sova: usize,
    pub with_ai: usize,
    pub with_cn: usize,
    /// Sova's chapter notes attached to stories (a note per story of its chapter).
    pub sova_notes: usize,
    pub dictionary_files: Vec<String>,
    pub dictionary_entries: usize,
    pub plugin_loaded: bool,
    /// arktr stories (scripts) found, and how many of them the library lists.
    pub arktr_stories: usize,
    pub arktr_stories_on_site: usize,
    pub arktr_rows_by_src_line: usize,
    pub arktr_rows_by_text: usize,
    pub arktr_rows_unattached: usize,
    pub arktr_unattached_examples: Vec<Unmatched>,
    pub millis: u128,
}

const EXAMPLES: usize = 10;

/// One story's id and its lines, in file order.
pub type StoryLines = (String, Vec<Line>);

/// Who a story sprite is (see [`lines::char_votes`]).
#[derive(Debug, Clone)]
pub struct CharName {
    pub char_id: String,
    pub name_en: String,
    pub name_ru: Option<String>,
    pub votes: u32,
    pub total: u32,
}

/// The import's output: every story's lines, the sprites' names, the summary.
pub struct Built {
    pub stories: Vec<StoryLines>,
    pub chars: Vec<CharName>,
    /// Sova's chapter notes by site story id.
    pub sova_notes: Vec<(String, Vec<String>)>,
    pub summary: ImportSummary,
}

/// Build every line of every story. Synchronous and CPU-bound: run it off the
/// async workers.
pub fn build(
    sources: &Sources,
    assets_dir: &Path,
    stories: &[(String, StoryRef)],
) -> anyhow::Result<Built> {
    let started = std::time::Instant::now();
    let mut summary = ImportSummary {
        server: "en".into(),
        ..ImportSummary::default()
    };

    let dict = xunity::load(&sources.ru_text_dir)
        .map_err(|e| anyhow::anyhow!("reading {}: {e}", sources.ru_text_dir.display()))?;
    summary.dictionary_files.clone_from(&dict.files);
    summary.dictionary_entries = dict.entries.len();
    let plugin = match &sources.plugin_dll {
        Some(p) => Some(
            plugin::PluginCatalog::load(p)
                .map_err(|e| anyhow::anyhow!("reading {}: {e}", p.display()))?,
        ),
        None => None,
    };
    summary.plugin_loaded = plugin.is_some();
    let matcher = Matcher::new(&dict, plugin.as_ref());
    let arktr = match &sources.arktr_dir {
        Some(d) => arktr::load(d)?,
        None => arktr::Arktr::default(),
    };
    let arktr_rows = &arktr.rows;
    summary.arktr_stories = arktr_rows.len();
    let mut sova_notes = Vec::new();

    let mut out = Vec::with_capacity(stories.len());
    let mut seen_txt = HashSet::new();
    let mut votes: HashMap<String, HashMap<String, u32>> = HashMap::new();
    for (id, story_ref) in stories {
        let script = match crate::core::story::load_script(assets_dir, &story_ref.story_txt) {
            Ok(s) => s,
            Err(_) => {
                summary.stories_without_script += 1;
                continue;
            }
        };
        summary.stories += 1;
        let commands = crate::core::story::parser::parse(&script);
        lines::char_votes(&commands, &mut votes);
        let mut lines = lines::displayed(&commands);
        for l in &mut lines {
            matcher.apply(l);
        }
        if let Some(notes) = arktr.notes.get(&story_ref.story_txt) {
            sova_notes.push((id.clone(), notes.clone()));
        }
        if let Some(rows) = arktr_rows.get(&story_ref.story_txt) {
            if seen_txt.insert(story_ref.story_txt.clone()) {
                summary.arktr_stories_on_site += 1;
            }
            let (counts, missed) = lines::attach_arktr(&mut lines, rows);
            summary.arktr_rows_by_src_line += counts.by_src_line;
            summary.arktr_rows_by_text += counts.by_text;
            summary.arktr_rows_unattached += counts.unattached;
            for row in missed {
                if summary.arktr_unattached_examples.len() < EXAMPLES {
                    summary.arktr_unattached_examples.push(Unmatched {
                        story_id: id.clone(),
                        line: row.src_line,
                        en: if row.en.is_empty() {
                            format!("(CN) {}", row.cn)
                        } else {
                            row.en.clone()
                        },
                    });
                }
            }
        }
        for l in &lines {
            summary.lines += 1;
            if l.ru_game.is_some() {
                summary.with_ru_game += 1;
            } else {
                summary.without_ru_game += 1;
                // Spread the examples over the corpus instead of one story's first lines.
                if summary.without_ru_game_examples.len() < EXAMPLES
                    && summary.without_ru_game % 97 == 1
                {
                    summary.without_ru_game_examples.push(Unmatched {
                        story_id: id.clone(),
                        line: l.line,
                        en: l.en.clone(),
                    });
                }
            }
            if let Some(m) = l.ru_game_match {
                *summary.ru_game_by_match.entry(m.to_owned()).or_default() += 1;
            }
            match l.plugin_role.as_deref() {
                Some("story") => summary.plugin_story += 1,
                Some("ambiguous:story") => summary.plugin_ambiguous += 1,
                _ => {}
            }
            summary.with_sova += usize::from(l.sova.is_some());
            summary.with_ai += usize::from(l.ai.is_some());
            summary.with_cn += usize::from(l.cn.is_some());
        }
        out.push((id.clone(), lines));
    }
    let mut chars: Vec<CharName> = votes
        .into_iter()
        .filter_map(|(char_id, by)| {
            let total: u32 = by.values().sum();
            let (name, n) = by
                .into_iter()
                .max_by(|a, b| a.1.cmp(&b.1).then_with(|| b.0.cmp(&a.0)))?;
            // A clear majority of at least two lines, else the sprite stays unnamed.
            (n >= 2 && n * 2 >= total).then(|| CharName {
                name_ru: matcher.dict(&name).map(|(v, _, _)| v),
                char_id,
                name_en: name,
                votes: n,
                total,
            })
        })
        .collect();
    chars.sort_by(|a, b| a.char_id.cmp(&b.char_id));
    summary.millis = started.elapsed().as_millis();
    summary.sova_notes = sova_notes.iter().map(|(_, n)| n.len()).sum();
    Ok(Built {
        stories: out,
        chars,
        sova_notes,
        summary,
    })
}

/// Replace the server's rows and record the run, in one transaction.
pub async fn store(
    pool: &PgPool,
    server: &str,
    started_at: chrono::DateTime<chrono::Utc>,
    stories: &[StoryLines],
    chars: &[CharName],
    sova_notes: &[(String, Vec<String>)],
    summary: &ImportSummary,
) -> Result<(), sqlx::Error> {
    // 20 binds per row, under Postgres's 65,535-parameter limit.
    const CHUNK: usize = 2_000;
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM translators.story_lines WHERE server = $1")
        .bind(server)
        .execute(&mut *tx)
        .await?;
    let rows: Vec<(&str, usize, &Line)> = stories
        .iter()
        .flat_map(|(id, lines)| {
            lines
                .iter()
                .enumerate()
                .map(move |(ord, l)| (id.as_str(), ord, l))
        })
        .collect();
    for chunk in rows.chunks(CHUNK) {
        let mut qb: QueryBuilder<Postgres> = QueryBuilder::new(
            "INSERT INTO translators.story_lines (server, story_id, line, part, ord, kind, speaker_en, speaker_ru, en, \
             ru_game, ru_game_source, ru_game_match, plugin_role, ru_dict, speaker_cn, cn, sova, ai, arktr_match, edit_key) ",
        );
        qb.push_values(chunk, |mut b, (id, ord, l)| {
            b.push_bind(server)
                .push_bind(*id)
                .push_bind(i32::try_from(l.line).unwrap_or(i32::MAX))
                .push_bind(l.part)
                .push_bind(i32::try_from(*ord).unwrap_or(i32::MAX))
                .push_bind(l.kind)
                .push_bind(&l.speaker_en)
                .push_bind(&l.speaker_ru)
                .push_bind(&l.en)
                .push_bind(&l.ru_game)
                .push_bind(&l.ru_game_source)
                .push_bind(l.ru_game_match)
                .push_bind(&l.plugin_role)
                .push_bind(&l.ru_dict)
                .push_bind(&l.speaker_cn)
                .push_bind(&l.cn)
                .push_bind(&l.sova)
                .push_bind(&l.ai)
                .push_bind(l.arktr_match)
                .push_bind(&l.edit_key);
        });
        // Two texts on one line and part would be a parser change; keep the first.
        qb.push(" ON CONFLICT (server, story_id, line, part) DO NOTHING");
        qb.build().execute(&mut *tx).await?;
    }
    sqlx::query("DELETE FROM translators.sova_notes")
        .execute(&mut *tx)
        .await?;
    let notes: Vec<(&str, i32, &str)> = sova_notes
        .iter()
        .flat_map(|(id, n)| {
            n.iter()
                .enumerate()
                .map(move |(i, t)| (id.as_str(), i32::try_from(i).unwrap_or(0), t.as_str()))
        })
        .collect();
    for chunk in notes.chunks(5_000) {
        let mut qb: QueryBuilder<Postgres> =
            QueryBuilder::new("INSERT INTO translators.sova_notes (story_id, idx, text) ");
        qb.push_values(chunk, |mut b, (id, i, t)| {
            b.push_bind(*id).push_bind(*i).push_bind(*t);
        });
        qb.build().execute(&mut *tx).await?;
    }
    sqlx::query("DELETE FROM translators.char_names")
        .execute(&mut *tx)
        .await?;
    for chunk in chars.chunks(5_000) {
        let mut qb: QueryBuilder<Postgres> = QueryBuilder::new(
            "INSERT INTO translators.char_names (char_id, name_en, name_ru, votes, total) ",
        );
        qb.push_values(chunk, |mut b, c| {
            b.push_bind(&c.char_id)
                .push_bind(&c.name_en)
                .push_bind(&c.name_ru)
                .push_bind(i32::try_from(c.votes).unwrap_or(i32::MAX))
                .push_bind(i32::try_from(c.total).unwrap_or(i32::MAX));
        });
        qb.build().execute(&mut *tx).await?;
    }
    sqlx::query(
        "INSERT INTO translators.imports (server, started_at, summary) VALUES ($1, $2, $3)",
    )
    .bind(server)
    .bind(started_at)
    .bind(sqlx::types::Json(summary))
    .execute(&mut *tx)
    .await?;
    tx.commit().await
}
