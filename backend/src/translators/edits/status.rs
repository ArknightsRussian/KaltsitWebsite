//! The rules of line editing, each in one place (translators/PLAN-edit.md
//! §1, §5): a line's status, a proposal's state, which lines can be edited
//! and when an edit needs a confirmation.

use crate::translators::import::normalize::plain;

/// More places than this: a proposal for every place is confirmed separately,
/// with the list (a proposal for one place never is).
pub const CONFIRM_PLACES: i32 = 1;

/// A proposal for one place only (SPEC §3): story lines only, and not a short
/// one — under this many visible characters or fewer than three words the
/// same English is one translation everywhere (UI elements and short replies
/// have no id of their own).
pub const CONTEXT_MIN_CHARS: usize = 20;
pub const CONTEXT_MIN_WORDS: usize = 3;

/// Whether a story line may get a proposal for its place only.
pub fn allows_context(edit_key: &str) -> bool {
    let p = plain(edit_key);
    p.chars().count() >= CONTEXT_MIN_CHARS && p.split_whitespace().count() >= CONTEXT_MIN_WORDS
}

/// The longest quoted fragment of a comment, in characters.
pub const MAX_QUOTE: usize = 500;

/// The longest proposal or comment, in characters.
pub const MAX_TEXT: usize = 4_000;

/// A line's status, by its edit key.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LineStatus {
    /// Nobody has looked at it yet (the default).
    Unchecked,
    /// At least one live proposal.
    Proposed,
    /// The lead approved a variant (the game's Russian included).
    Approved,
    /// An approval or proposal made at this place is for an English text the
    /// story no longer has here.
    Outdated,
}

impl LineStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Unchecked => "unchecked",
            Self::Proposed => "proposed",
            Self::Approved => "approved",
            Self::Outdated => "outdated",
        }
    }
}

/// Approved wins (the line's current text is decided); then an outdated
/// decision left at this place; then live proposals.
pub fn line_status(approved: bool, outdated_here: bool, proposals: usize) -> LineStatus {
    if approved {
        LineStatus::Approved
    } else if outdated_here {
        LineStatus::Outdated
    } else if proposals > 0 {
        LineStatus::Proposed
    } else {
        LineStatus::Unchecked
    }
}

/// One proposal's state for "My edits".
pub fn proposal_state(outdated: bool, approved: Option<Option<i64>>, id: i64) -> &'static str {
    if outdated {
        return "outdated";
    }
    match approved {
        Some(Some(p)) if p == id => "approved",
        // Another variant (or the game's Russian) was approved.
        Some(_) => "otherApproved",
        None => "proposed",
    }
}

/// A line with no letter and no digit (dots, dashes, an ellipsis) is not
/// edited: there is nothing to translate.
pub fn editable(edit_key: &str) -> bool {
    plain(edit_key).chars().any(char::is_alphanumeric)
}

/// A proposal's text as stored: line breaks as LF, trimmed. `None` when
/// empty or too long.
pub fn clean_text(text: &str) -> Option<String> {
    let t = text.replace("\r\n", "\n").replace('\r', "\n");
    let t = t.trim();
    (!t.is_empty() && t.chars().count() <= MAX_TEXT).then(|| t.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_precedence() {
        assert_eq!(line_status(false, false, 0), LineStatus::Unchecked);
        assert_eq!(line_status(false, false, 2), LineStatus::Proposed);
        assert_eq!(line_status(false, true, 2), LineStatus::Outdated);
        assert_eq!(line_status(true, true, 2), LineStatus::Approved);
    }

    #[test]
    fn proposal_states() {
        assert_eq!(proposal_state(false, None, 1), "proposed");
        assert_eq!(proposal_state(false, Some(Some(1)), 1), "approved");
        assert_eq!(proposal_state(false, Some(None), 1), "otherApproved");
        assert_eq!(proposal_state(false, Some(Some(2)), 1), "otherApproved");
        assert_eq!(proposal_state(true, Some(Some(1)), 1), "outdated");
    }

    #[test]
    fn punctuation_only_lines_are_not_edited() {
        assert!(!editable("……"));
        assert!(!editable("—!?"));
        assert!(!editable("<i>...</i>"));
        assert!(editable("Hm."));
        assert!(editable("3"));
    }

    #[test]
    fn short_lines_have_no_one_place_proposal() {
        assert!(!allows_context("Yes."));
        assert!(!allows_context("Are you okay?"));
        assert!(!allows_context("<i>Huh?</i> What?"));
        assert!(allows_context(
            "Looks like they didn't have time to notify the others."
        ));
    }

    #[test]
    fn texts_are_cleaned() {
        assert_eq!(clean_text("  Да.\r\nНет. ").as_deref(), Some("Да.\nНет."));
        assert_eq!(clean_text("   "), None);
        assert_eq!(clean_text(&"а".repeat(MAX_TEXT + 1)), None);
    }
}
