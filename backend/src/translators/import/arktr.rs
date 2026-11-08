//! Sova's and the AI's Russian, and the CN original, from the arktr pipeline's
//! output (`data/out/stage_*.json`). Read only.
//!
//! A row's `story_id` is the script path (`StoryTxt`), `src_line` its 1-based
//! line in the CN script, and `ru` one text whose `source` says whose it is:
//! `sova*` (Sova's, `ru_sova` holding her original when errata corrected it),
//! `ai_en` / `ai_cn` (machine), `punct` (punctuation only) or `pending` (none).

use std::collections::HashMap;
use std::path::Path;

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Row {
    pub src_line: u32,
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub opt: Option<u32>,
    #[serde(default)]
    pub speaker_cn: String,
    #[serde(default)]
    pub cn: String,
    #[serde(default)]
    pub en: String,
    #[serde(default)]
    pub ru: String,
    #[serde(default)]
    pub source: String,
}

impl Row {
    /// Sova's text for this row, when it is hers.
    pub fn sova(&self) -> Option<&str> {
        (self.source.starts_with("sova") && !self.ru.trim().is_empty()).then_some(self.ru.as_str())
    }

    /// The AI's text for this row, when it is the machine's.
    pub fn ai(&self) -> Option<&str> {
        (self.source.starts_with("ai_") && !self.ru.trim().is_empty()).then_some(self.ru.as_str())
    }

    /// arktr keeps escapes literal (`\n` as two characters); the site decodes them.
    pub fn en_decoded(&self) -> String {
        self.en.replace("\\n", "\n")
    }
}

#[derive(Deserialize)]
struct Stage {
    #[serde(default)]
    stories: Vec<Story>,
}

#[derive(Deserialize)]
struct Story {
    story_id: String,
    #[serde(default)]
    rows: Vec<Row>,
}

/// Rows by script path. A script listed by two stages keeps the first.
pub fn load(dir: &Path) -> anyhow::Result<HashMap<String, Vec<Row>>> {
    let out_dir = dir.join("data/out");
    let mut paths: Vec<_> = std::fs::read_dir(&out_dir)?
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with("stage_") && n.ends_with(".json"))
        })
        .collect();
    paths.sort();
    let mut out: HashMap<String, Vec<Row>> = HashMap::new();
    for path in paths {
        let stage: Stage = serde_json::from_slice(&std::fs::read(&path)?)
            .map_err(|e| anyhow::anyhow!("{}: {e}", path.display()))?;
        for story in stage.stories {
            out.entry(story.story_id).or_insert(story.rows);
        }
    }
    Ok(out)
}
