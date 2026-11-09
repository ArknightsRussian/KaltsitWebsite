//! The export to the XUnity dictionaries (translators/PLAN-edit.md §6).
//!
//! Two modes: `approved` (for the game: the lead's approvals other than "as in
//! the game") and `review` (every proposal not approved, one per entry, the
//! most agreed; marked REVIEW in the file names and headers). Two formats:
//! `file` (one `00_translators.txt`, with the report naming the files that
//! override it by the load order, kit §3.3) and `patch` (copies of
//! `11_ui.txt`, `12_story.txt`, `13_names.txt` with the touched values
//! replaced; entries none of them has go to the end of the `12_story.txt`
//! copy). Lines the RichTextFix plugin shows (role `story`) never go to a
//! dictionary file: they go to `plugin.csv`. Proposals for one place go to
//! `context.csv` ("needs a translation tied to its place"). Keys XUnity cannot
//! read back (`r:` / `sr:`, empty) go to the report.

pub mod encode;

use std::collections::{BTreeMap, HashMap};
use std::path::Path;

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use ts_rs::TS;
use utoipa::{IntoParams, ToSchema};

use super::SERVER;
use super::import::xunity::{decode_line, load_order};
use encode::encode_line;

/// The dictionaries the `patch` format copies, in the pack's names.
pub const PATCHED: &[&str] = &["11_ui.txt", "12_story.txt", "13_names.txt"];

/// What to export.
#[derive(Debug, Clone, Deserialize, IntoParams)]
#[serde(rename_all = "camelCase")]
#[into_params(parameter_in = Query)]
pub struct ExportQuery {
    /// `approved` (for the game) or `review` (proposals, for checking).
    pub mode: String,
    /// `file` (00_translators.txt) or `patch` (copies of 11_ui / 12_story / 13_names).
    pub format: String,
}

/// One file of an export.
#[derive(Debug, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ExportFile {
    pub name: String,
    pub content: String,
}

/// A translation left out of the dictionary file, and why.
#[derive(Debug, Clone, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ExportSkipped {
    pub key: String,
    pub reason: String,
}

/// A dictionary file and how many of the exported keys it holds.
#[derive(Debug, Clone, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ExportFileKeys {
    pub file: String,
    pub keys: i32,
}

/// What an export wrote and what to know before putting it in the game.
#[derive(Debug, Clone, Default, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ExportReport {
    pub mode: String,
    pub format: String,
    /// Unix seconds.
    #[ts(type = "number")]
    pub at: i64,
    pub by: String,
    /// Lines written to the dictionary file (or replaced and appended in the patch).
    pub written: i32,
    /// Left out: keys XUnity cannot read back.
    pub skipped: Vec<ExportSkipped>,
    /// Rows of `plugin.csv` (lines the RichTextFix plugin shows).
    pub plugin_rows: i32,
    /// Rows of `context.csv` (proposals for one place).
    pub context_rows: i32,
    /// `file` format: the files the game loads after ours, which win on the same key.
    pub loaded_after: Vec<String>,
    /// Of those, the ones holding exported keys, and how many.
    pub overridden_by: Vec<ExportFileKeys>,
    /// `patch` format: values replaced in each copied file.
    pub replaced: Vec<ExportFileKeys>,
    /// `patch` format: entries none of the files had, added at the end of the 12_story copy.
    pub appended: i32,
    /// `review` mode: entries with more than one proposal (the most agreed is exported).
    pub with_alternatives: i32,
}

/// The export's files and its report.
#[derive(Debug, Serialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ExportResult {
    pub files: Vec<ExportFile>,
    pub report: ExportReport,
}

/// One entry to export.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Row {
    pub edit_key: String,
    pub text: String,
    pub ru_game: Option<String>,
    pub plugin_role: Option<String>,
    pub alternatives: i64,
}

/// One proposal for one place.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ContextRow {
    pub story_id: String,
    pub ord: Option<i32>,
    pub en: Option<String>,
    pub ru_game: Option<String>,
    pub text: String,
    pub author: String,
    pub approved: bool,
}

/// The entries of a mode, by key.
pub async fn rows(pool: &PgPool, review: bool) -> Result<Vec<Row>, sqlx::Error> {
    let first_line = "LEFT JOIN LATERAL (
             SELECT s.ru_game, s.plugin_role FROM translators.story_lines s
             WHERE s.server = $1 AND s.edit_key = x.edit_key LIMIT 1) k ON TRUE";
    if review {
        sqlx::query_as(&format!(
            "SELECT x.edit_key, x.text, k.ru_game, k.plugin_role, x.alternatives FROM (
                 SELECT DISTINCT ON (p.edit_key) p.edit_key, p.text,
                        COUNT(*) OVER (PARTITION BY p.edit_key) AS alternatives
                 FROM translators.proposals p
                 WHERE p.deleted_at IS NULL AND NOT p.context AND p.outdated_at IS NULL
                   AND NOT EXISTS (SELECT 1 FROM translators.approvals a
                                   WHERE a.edit_key = p.edit_key AND a.outdated_at IS NULL)
                 ORDER BY p.edit_key,
                          (SELECT COUNT(*) FROM translators.agreements g WHERE g.proposal_id = p.id) DESC,
                          p.created_at) x
             {first_line}
             ORDER BY x.edit_key"
        ))
        .bind(SERVER)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query_as(&format!(
            "SELECT x.edit_key, x.text, k.ru_game, k.plugin_role, 1::bigint AS alternatives
             FROM translators.approvals x
             {first_line}
             WHERE x.outdated_at IS NULL AND x.variant <> 'game'
             ORDER BY x.edit_key"
        ))
        .bind(SERVER)
        .fetch_all(pool)
        .await
    }
}

/// Proposals for one place: approved ones (`approved` mode) or the others (`review`).
pub async fn context_rows(pool: &PgPool, review: bool) -> Result<Vec<ContextRow>, sqlx::Error> {
    sqlx::query_as(
        "SELECT p.story_id, s.ord, s.en, s.ru_game, p.text,
                COALESCE(NULLIF(u.nickname, ''), u.uid) AS author, p.approved_at IS NOT NULL AS approved
         FROM translators.proposals p
         JOIN users u ON u.id = p.author_id
         LEFT JOIN translators.story_lines s
             ON s.server = $1 AND s.story_id = p.story_id AND s.line = p.line AND s.part = p.part
         WHERE p.deleted_at IS NULL AND p.context AND p.outdated_at IS NULL
           AND (p.approved_at IS NOT NULL) = NOT $2
         ORDER BY p.story_id, s.ord",
    )
    .bind(SERVER)
    .bind(review)
    .fetch_all(pool)
    .await
}

/// A CSV cell: quoted when it holds a separator, a quote or a line break.
fn cell(s: &str) -> String {
    if s.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_owned()
    }
}

/// A CSV for Excel: UTF-8 with a BOM (so Cyrillic opens right), CRLF rows.
fn csv(header: &[&str], rows: &[Vec<String>]) -> String {
    let mut out = String::from("\u{feff}");
    out.push_str(&header.iter().map(|h| cell(h)).collect::<Vec<_>>().join(","));
    out.push_str("\r\n");
    for r in rows {
        out.push_str(&r.iter().map(|c| cell(c)).collect::<Vec<_>>().join(","));
        out.push_str("\r\n");
    }
    out
}

/// The `//` header of an exported dictionary file.
fn header(report: &ExportReport, lines: usize, what: &str) -> String {
    let when = chrono::DateTime::from_timestamp(report.at, 0)
        .map(|t| t.format("%Y-%m-%d %H:%M UTC").to_string())
        .unwrap_or_default();
    let mut out = String::new();
    if report.mode == "review" {
        out.push_str("// REVIEW — НЕ ДЛЯ ИГРЫ БЕЗ ПРОВЕРКИ: неутверждённые предложения\n");
    }
    out.push_str(&format!(
        "// ArknightsRU — {what} раздела «Для переводчиков» (KaltsitWebsite)\n// Выгружено: {when} · строк: {lines} · выгрузил(а): {}\n",
        report.by
    ));
    out
}

/// The export, from the rows and (for `patch` and the report) the pack's
/// dictionaries folder. Pure apart from reading that folder.
pub fn build(
    rows: &[Row],
    context: &[ContextRow],
    review: bool,
    patch: bool,
    text_dir: &Path,
    by: &str,
    at: i64,
) -> std::io::Result<ExportResult> {
    let mut report = ExportReport {
        mode: if review { "review" } else { "approved" }.to_owned(),
        format: if patch { "patch" } else { "file" }.to_owned(),
        at,
        by: by.to_owned(),
        ..ExportReport::default()
    };
    let tag = if review { "REVIEW_" } else { "" };
    let mut files = Vec::new();

    // Plugin lines apart; unchanged texts dropped; unwritable keys reported.
    let mut entries: BTreeMap<String, String> = BTreeMap::new();
    let mut plugin: Vec<Vec<String>> = Vec::new();
    for r in rows {
        if r.ru_game.as_deref() == Some(r.text.as_str()) {
            continue;
        }
        report.with_alternatives += i32::from(r.alternatives > 1);
        if r.plugin_role.as_deref() == Some("story") {
            plugin.push(vec![
                r.edit_key.clone(),
                "story".to_owned(),
                r.ru_game.clone().unwrap_or_default(),
                r.text.clone(),
            ]);
            continue;
        }
        match encode_line(&r.edit_key, &r.text) {
            Ok(_) => {
                entries.insert(r.edit_key.clone(), r.text.clone());
            }
            Err(e) => report.skipped.push(ExportSkipped {
                key: r.edit_key.clone(),
                reason: e.as_str().to_owned(),
            }),
        }
    }

    let ours = if review {
        "00_translators_REVIEW.txt"
    } else {
        "00_translators.txt"
    };
    if patch {
        let mut left: BTreeMap<String, String> = entries.clone();
        for name in PATCHED {
            let path = text_dir.join(name);
            let Ok(content) = std::fs::read_to_string(&path) else {
                continue;
            };
            let mut replaced = 0;
            let mut body = String::with_capacity(content.len());
            for raw in content.split('\n') {
                let line = raw.strip_suffix('\r').unwrap_or(raw);
                match decode_line(line).and_then(|(k, _)| entries.get(&k).map(|v| (k, v))) {
                    Some((k, v)) => {
                        // Checked above: every kept entry encodes.
                        body.push_str(&encode_line(&k, v).unwrap_or_default());
                        left.remove(&k);
                        replaced += 1;
                    }
                    None => body.push_str(line),
                }
                body.push('\n');
            }
            if body.ends_with("\n\n") {
                body.pop();
            }
            if *name == "12_story.txt" && !left.is_empty() {
                body.push_str("// Новые записи раздела «Для переводчиков»\n");
                for (k, v) in &left {
                    body.push_str(&encode_line(k, v).unwrap_or_default());
                    body.push('\n');
                }
                report.appended = i32::try_from(left.len()).unwrap_or(i32::MAX);
            }
            report.replaced.push(ExportFileKeys {
                file: (*name).to_owned(),
                keys: replaced,
            });
            let head = header(&report, usize::try_from(replaced).unwrap_or(0), "заплатка");
            files.push(ExportFile {
                name: format!("{tag}{name}"),
                content: format!("{head}{body}"),
            });
        }
        report.written = report.replaced.iter().map(|r| r.keys).sum::<i32>() + report.appended;
    } else {
        let mut body = String::new();
        for (k, v) in &entries {
            body.push_str(&encode_line(k, v).unwrap_or_default());
            body.push('\n');
        }
        report.written = i32::try_from(entries.len()).unwrap_or(i32::MAX);
        let head = header(&report, entries.len(), "правки");
        files.push(ExportFile {
            name: ours.to_owned(),
            content: format!("{head}{body}"),
        });
    }

    // What the game loads after our file (kit §3.3: by full path, descending,
    // case-insensitive; a later file wins on the same key).
    let ours_path = text_dir.join(ours).to_string_lossy().to_lowercase();
    let mut keys_after: HashMap<String, i32> = HashMap::new();
    for path in load_order(text_dir).unwrap_or_default() {
        let lower = path.to_string_lossy().to_lowercase();
        let name = path
            .strip_prefix(text_dir)
            .map_or_else(|_| lower.clone(), |p| p.to_string_lossy().into_owned());
        let after = if patch {
            // A patch replaces the pack's files; 11_ui.txt of them loads last.
            !PATCHED.iter().any(|p| name.eq_ignore_ascii_case(p))
                && lower < text_dir.join("11_ui.txt").to_string_lossy().to_lowercase()
        } else {
            lower < ours_path
        };
        if !after || name.eq_ignore_ascii_case(ours) {
            continue;
        }
        report.loaded_after.push(name.clone());
        let count = std::fs::read_to_string(&path)
            .map(|c| {
                c.split(['\r', '\n'])
                    .filter_map(decode_line)
                    .filter(|(k, _)| entries.contains_key(k))
                    .count()
            })
            .unwrap_or(0);
        if count > 0 {
            keys_after.insert(name, i32::try_from(count).unwrap_or(i32::MAX));
        }
    }
    report.overridden_by = report
        .loaded_after
        .iter()
        .filter_map(|f| {
            keys_after.get(f).map(|&keys| ExportFileKeys {
                file: f.clone(),
                keys,
            })
        })
        .collect();

    report.plugin_rows = i32::try_from(plugin.len()).unwrap_or(i32::MAX);
    files.push(ExportFile {
        name: format!("{tag}plugin.csv"),
        content: csv(
            &[
                "ключ (английский)",
                "роль плагина",
                "было (в игре)",
                "стало",
            ],
            &plugin,
        ),
    });
    let ctx: Vec<Vec<String>> = context
        .iter()
        .map(|c| {
            vec![
                c.story_id.clone(),
                c.ord.map(|o| (o + 1).to_string()).unwrap_or_default(),
                c.en.clone().unwrap_or_default(),
                c.ru_game.clone().unwrap_or_default(),
                c.text.clone(),
                c.author.clone(),
                if c.approved { "да" } else { "нет" }.to_owned(),
            ]
        })
        .collect();
    report.context_rows = i32::try_from(ctx.len()).unwrap_or(i32::MAX);
    files.push(ExportFile {
        name: format!("{tag}context.csv"),
        content: csv(
            &[
                "история",
                "№ строки",
                "английский",
                "было (в игре)",
                "стало",
                "автор",
                "утверждено",
            ],
            &ctx,
        ),
    });
    files.push(ExportFile {
        name: format!("{tag}report.txt"),
        content: report_text(&report, ours),
    });
    Ok(ExportResult { files, report })
}

/// The report as a text file next to the export.
fn report_text(r: &ExportReport, ours: &str) -> String {
    let mut out = String::new();
    let when = chrono::DateTime::from_timestamp(r.at, 0)
        .map(|t| t.format("%Y-%m-%d %H:%M UTC").to_string())
        .unwrap_or_default();
    out.push_str(&format!(
        "Выгрузка раздела «Для переводчиков»\nРежим: {}\nФормат: {}\nКогда: {when}\nКто: {}\n\n",
        if r.mode == "review" {
            "все предложения — на проверку (REVIEW, не для игры)"
        } else {
            "утверждённое — для игры"
        },
        if r.format == "patch" {
            "заплатка (копии 11_ui / 12_story / 13_names)"
        } else {
            ours
        },
        r.by
    ));
    out.push_str(&format!("Записано строк: {}\n", r.written));
    for f in &r.replaced {
        out.push_str(&format!("  заменено в {}: {}\n", f.file, f.keys));
    }
    if r.format == "patch" {
        out.push_str(&format!(
            "  новых записей в конце 12_story.txt: {}\n",
            r.appended
        ));
    }
    if r.mode == "review" {
        out.push_str(&format!(
            "Записей с несколькими предложениями (взято с наибольшим «согласен»): {}\n",
            r.with_alternatives
        ));
    }
    out.push_str(&format!(
        "Для плагина RichTextFix (plugin.csv): {}\n",
        r.plugin_rows
    ));
    out.push_str(&format!(
        "С привязкой к месту (context.csv): {}\n",
        r.context_rows
    ));
    out.push_str(&format!(
        "Не записано (XUnity не прочтёт): {}\n",
        r.skipped.len()
    ));
    for s in &r.skipped {
        out.push_str(&format!("  {} — {}\n", s.key, s.reason));
    }
    out.push_str(
        "\nФайлы, которые игра грузит ПОСЛЕ нашего (при одинаковом ключе побеждают они):\n",
    );
    if r.loaded_after.is_empty() {
        out.push_str("  нет — наш файл побеждает\n");
    }
    for f in &r.loaded_after {
        let keys = r
            .overridden_by
            .iter()
            .find(|o| &o.file == f)
            .map_or(0, |o| o.keys);
        out.push_str(&format!("  {f} — перекрывает наших ключей: {keys}\n"));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(k: &str, v: &str, ru: Option<&str>, plugin: bool) -> Row {
        Row {
            edit_key: k.into(),
            text: v.into(),
            ru_game: ru.map(str::to_owned),
            plugin_role: plugin.then(|| "story".to_owned()),
            alternatives: 1,
        }
    }

    #[test]
    fn file_format_with_the_report() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("12_story.txt"), "// c\nHi=Привет\n").unwrap();
        std::fs::write(dir.path().join("00_arktr_story.txt"), "Hi=Здорово\n").unwrap();
        std::fs::write(dir.path().join("00_zz.txt"), "Other=x\n").unwrap();
        let rows = vec![
            row("Hi", "Здравствуй", Some("Привет"), false),
            row("Same", "Так же", Some("Так же"), false),
            row("Plugin line", "Новое", Some("Старое"), true),
            row("r:^x$", "y", None, false),
            row("a=b\nc", "д=е\nж", None, false),
        ];
        let out = build(&rows, &[], false, false, dir.path(), "dev", 0).unwrap();
        let file = &out.files[0];
        assert_eq!(file.name, "00_translators.txt");
        let lines: Vec<_> = file
            .content
            .lines()
            .filter(|l| !l.starts_with("//"))
            .collect();
        let back: Vec<_> = lines.iter().filter_map(|l| decode_line(l)).collect();
        assert_eq!(
            back,
            vec![
                ("Hi".into(), "Здравствуй".into()),
                ("a=b\nc".into(), "д=е\nж".into())
            ]
        );
        assert!(!file.content.starts_with('\u{feff}') && !file.content.contains('\r'));
        assert_eq!(out.report.written, 2);
        assert_eq!(out.report.plugin_rows, 1);
        assert_eq!(out.report.skipped[0].key, "r:^x$");
        // 00_arktr_story loads after 00_translators and holds "Hi"; 00_zz loads before.
        assert_eq!(out.report.loaded_after, vec!["00_arktr_story.txt"]);
        assert_eq!(out.report.overridden_by[0].keys, 1);
    }

    #[test]
    fn patch_format_replaces_and_appends() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("11_ui.txt"), "// h\nOK=Ок\nHi=Привет\n").unwrap();
        std::fs::write(
            dir.path().join("12_story.txt"),
            "// h\nHi=Привет\nBye=Пока\n",
        )
        .unwrap();
        let rows = vec![
            row("Hi", "Здравствуй", Some("Привет"), false),
            row("New", "Новое", None, false),
        ];
        let out = build(&rows, &[], true, true, dir.path(), "dev", 0).unwrap();
        let ui = out
            .files
            .iter()
            .find(|f| f.name == "REVIEW_11_ui.txt")
            .unwrap();
        let story = out
            .files
            .iter()
            .find(|f| f.name == "REVIEW_12_story.txt")
            .unwrap();
        assert!(ui.content.contains("Hi=Здравствуй\n") && ui.content.contains("OK=Ок\n"));
        assert!(
            story.content.contains("Hi=Здравствуй\nBye=Пока\n")
                && story.content.ends_with("New=Новое\n")
        );
        assert!(story.content.starts_with("// REVIEW"));
        assert_eq!(out.report.appended, 1);
        assert_eq!(out.report.written, 3);
    }
}
