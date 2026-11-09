import { defineMessages, type MessageMap } from "#/lib/i18n/messages";

export const namespace = "translators";

export const messages = {
    "meta.title": {
        text: "For translators",
        description: "Browser tab title of the translators' section (/translators).",
    },
    "meta.description": {
        text: "Story text side by side: English, Russian as the game shows it now, and Chinese.",
        description: "Search-engine description of the translators' section.",
    },
    "page.title": {
        text: "For translators",
        description: "Page heading of the translators' section.",
    },
    "page.description": {
        text: "Story text side by side: English, Russian as the game shows it now with the ArknightsRU pack, and the Chinese original. Members propose translations and comment on lines.",
        description: "Line under the heading of the translators' section.",
    },
    "tabs.label": {
        text: "Section views",
        description: "Accessible name of the tab strip of the translators' section.",
    },
    "tabs.story": {
        text: "Story",
        description: "Tab of the translators' section: chapter, story and its lines.",
    },
    "tabs.glossary": {
        text: "Glossary",
        description: "Tab of the translators' section: the team's whole glossary, read from its Google Sheet.",
    },
    "access.title": {
        text: "No access",
        description: "Heading shown on the translators' section to anyone who is not a member of the translation team.",
    },
    "access.description": {
        text: "This section is for the Russian translation team. Sign in and ask the team to add your account.",
        description: "Line under the No access heading.",
    },
    "load.access": {
        text: "Couldn't check your access to the section.",
        description: "Load failure of the membership check of the translators' section.",
    },
    "picker.chapter": {
        text: "Chapter",
        description: "Label of the chapter (story group) search box.",
    },
    "picker.chapterPlaceholder": {
        text: "Search {count, plural, one {# chapter} other {# chapters}}",
        description: "Placeholder of the chapter search box; count is the number of chapters.",
    },
    "picker.chapterEmpty": {
        text: "No chapters match.",
        description: "Shown in the chapter search list when nothing matches the typed text.",
    },
    "picker.story": {
        text: "Story",
        description: "Label of the story select inside the chosen chapter.",
    },
    "picker.storyPlaceholder": {
        text: "Choose a story",
        description: "Story select before a story is chosen.",
    },
    "category.main": { text: "Main story", description: "Chapter kind in the chapter list." },
    "category.side": { text: "Event", description: "Chapter kind in the chapter list." },
    "category.vignette": { text: "Side story", description: "Chapter kind in the chapter list." },
    "category.record": { text: "Operator record", description: "Chapter kind in the chapter list." },
    "category.is": { text: "Integrated Strategies", description: "Chapter kind in the chapter list." },
    "category.reclamation": { text: "Reclamation Algorithm", description: "Chapter kind in the chapter list." },
    "category.sideContent": { text: "Other", description: "Chapter kind in the chapter list." },
    "toggle.cn": {
        text: "Chinese",
        description: "Switch that shows the Chinese column of the table.",
    },
    "toggle.cnHint": {
        text: "The Chinese original, for the stories already processed in arktr.",
        description: "Second line under the Chinese switch.",
    },
    "toggle.service": {
        text: "Service",
        description: "Switch that shows script line numbers and the script's stage commands (scene, background, pause…) between the lines.",
    },
    "toggle.serviceHint": {
        text: "Script lines and stage commands.",
        description: "Second line under the Service switch.",
    },
    "toggle.variants": {
        text: "Show variants",
        description: "Switch that shows Sova's and the AI's translations under each Russian line.",
    },
    "toggle.variantsHint": {
        text: "Sova and the AI under the Russian.",
        description: "Second line under the Show variants switch.",
    },
    "book.back": {
        text: "Back to the section",
        description: "Button above the book view opened from the translators' section: returns to the same chapter and story.",
    },
    "book.open": {
        text: "Book view",
        description: "Link that opens the chosen story in the site's book view.",
    },
    "table.label": {
        text: "Lines of {story}",
        description: "Accessible name of the lines table; story is the story's title.",
    },
    "table.line": { text: "#", description: "Column: the line's number in the story (1, 2, 3…)." },
    "table.scriptLine": {
        text: "line {line}",
        description: "Under a line's number, and before a stage command, when Service is on: its line in the English script file.",
    },
    "table.speaker": { text: "Speaker", description: "Column: who says the line." },
    "table.en": { text: "English", description: "Column: the English text." },
    "table.ru": { text: "Russian (in game)", description: "Column: the Russian the game shows now." },
    "table.cn": { text: "Chinese", description: "Column: the Chinese original." },
    "table.summary": {
        text: "{count, plural, one {# line} other {# lines}}, {ru} with Russian",
        description: "Count above the lines table; ru is how many have a Russian text.",
    },
    "line.option": {
        text: "Choice {part}",
        description: "Badge of a reply option of the player's decision in the lines table.",
    },
    "line.subtitle": { text: "Caption", description: "Label of a subtitle text (shown over the scene) in the lines table." },
    "line.sticker": { text: "On-screen text", description: "Label of a sticker text in the lines table." },
    "ru.missing": {
        text: "No translation found",
        description: "Russian cell when no dictionary line matched the English text.",
    },
    "ru.lineByLine": {
        text: "Assembled line by line",
        description: "Note under a Russian text that was found one line at a time.",
    },
    "plugin.badge": {
        text: "Plugin",
        description: "Badge on a line whose Russian comes from the RichTextFix plugin's built-in catalog.",
    },
    "plugin.hint": {
        text: "Line from the plugin: an edit through the dictionary may not take effect.",
        description: "Explanation behind the Plugin badge.",
    },
    "ambiguous.badge": {
        text: "Left in English",
        description: "Badge on a line the plugin deliberately shows untranslated.",
    },
    "ambiguous.hint": {
        text: "The plugin shows this line in English on purpose, whatever the dictionary says.",
        description: "Explanation behind the Left in English badge.",
    },
    "service.label": {
        text: "Stage commands",
        description: "Accessible name of a gray separator row listing the script's stage commands between two lines.",
    },
    "terms.label": {
        text: "Glossary terms in this line",
        description: "Accessible name of the list of glossary terms found in a line's English.",
    },
    "terms.found": {
        text: "form found",
        description: "Mark beside a glossary term whose Russian form is in the line's Russian.",
    },
    "terms.notFound": {
        text: "form not found",
        description: "Mark beside a glossary term whose Russian form is not in the line's Russian (by word stem). Not an error.",
    },
    "terms.variant": {
        text: "Sova's glossary",
        description: "Mark beside a term from the sheet copied from Sova's glossary: a variant, never checked.",
    },
    "hints.sova": { text: "Sova", description: "Label of Sova's translation of a line." },
    "hints.ai": { text: "AI", description: "Label of the machine translation of a line." },
    "hints.dict": {
        text: "Dictionary (overridden by the plugin)",
        description: "Label of the dictionary's own Russian when the plugin shows a different one.",
    },
    "devLogin.link": {
        text: "Development sign-in",
        description: "Link to the development sign-in page, shown only when it is switched on.",
    },
    "empty.choose": {
        text: "Choose a chapter and a story.",
        description: "Shown before a story is chosen.",
    },
    "empty.notImported": {
        text: "The story text has not been imported yet.",
        description: "Shown when the section's database is empty.",
    },
    "empty.noLines": {
        text: "This story has no text lines.",
        description: "Shown for a story with nothing to translate.",
    },
    "load.index": {
        text: "Couldn't load the story list.",
        description: "Load failure of the chapter list.",
    },
    "load.lines": {
        text: "Couldn't load the story lines.",
        description: "Load failure of the lines table.",
    },
    "glossary.load": {
        text: "Couldn't load the glossary.",
        description: "Load failure of the Glossary tab.",
    },
    "glossary.copy": {
        text: "Copy downloaded {date}",
        description: "Date of the stored copy of the glossary.",
    },
    "glossary.none": {
        text: "The glossary hasn't been downloaded yet.",
        description: "Shown on the Glossary tab when no copy is stored.",
    },
    "glossary.failed": {
        text: "The last download failed ({date}). The stored copy is shown.",
        description: "Warning when the last download of the glossary failed; date is the attempt's time.",
    },
    "glossary.refresh": {
        text: "Refresh glossary",
        description: "Button that downloads the glossary again from the team's Google Sheet.",
    },
    "glossary.refreshing": {
        text: "Downloading…",
        description: "The refresh button while the download runs.",
    },
    "glossary.open": {
        text: "Open in the sheet",
        description: "Link to the team's Google Sheet, where the glossary is edited.",
    },
    "glossary.readOnly": {
        text: "Edits are made in the sheet only.",
        description: "Note beside the link to the sheet.",
    },
    "glossary.search": {
        text: "Search English or Russian",
        description: "Placeholder of the glossary search box.",
    },
    "glossary.searchLabel": {
        text: "Search the glossary",
        description: "Accessible name of the glossary search box.",
    },
    "glossary.clear": {
        text: "Clear search",
        description: "Button that empties the glossary search box.",
    },
    "glossary.sheet": {
        text: "Sheet",
        description: "Label of the sheet filter of the glossary, and its column.",
    },
    "glossary.sheetAll": {
        text: "All sheets",
        description: "Sheet filter option: every sheet.",
    },
    "glossary.sort": {
        text: "Sort",
        description: "Label of the glossary sort select.",
    },
    "glossary.sort.sheet": { text: "As in the sheet", description: "Sort option: sheet and row order." },
    "glossary.sort.en": { text: "English A–Z", description: "Sort option: by the English term." },
    "glossary.sort.ru": { text: "Russian А–Я", description: "Sort option: by the Russian term." },
    "glossary.sort.count": { text: "Most used in the story", description: "Sort option: by how many story lines hold the term." },
    "glossary.col.en": { text: "English", description: "Glossary column: the English term." },
    "glossary.col.ru": { text: "Russian", description: "Glossary column: how to translate it." },
    "glossary.col.notes": { text: "Notes", description: "Glossary column: the sheet's notes, synonyms and comment." },
    "glossary.col.count": { text: "In story", description: "Glossary column: how many story lines hold the term." },
    "glossary.plural": {
        text: "pl. {form}",
        description: "The Russian plural of a race or similar term; form is the plural.",
    },
    "glossary.summary": {
        text: "{shown, plural, one {# term} other {# terms}} of {total}",
        description: "Count above the glossary table.",
    },
    "glossary.empty": {
        text: "No terms match.",
        description: "Shown when the search and filter leave no terms.",
    },
    "glossary.tableLabel": {
        text: "Team glossary",
        description: "Accessible name of the glossary table.",
    },
    "dev.title": {
        text: "Development sign-in",
        description: "Heading of the development sign-in page.",
    },
    "dev.description": {
        text: "Signs you in as a local translator account without a game account. Works only on a backend started with TRANSLATORS_DEV_LOGIN=1.",
        description: "Line under the heading of the development sign-in page.",
    },
    "dev.button": {
        text: "Sign in as translator",
        description: "Button on the development sign-in page.",
    },
    "dev.off": {
        text: "Development sign-in is switched off on this backend.",
        description: "Shown on the development sign-in page when the backend does not allow it.",
    },
    "dev.failed": {
        text: "Couldn't sign in.",
        description: "Shown when the development sign-in request fails.",
    },
    "tabs.edits": {
        text: "My edits",
        description: "Tab of the translators' section: the member's own proposals (everyone's for the lead), with history.",
    },
    "status.unchecked": {
        text: "Not checked",
        description: "Status of a story line nobody has proposed or decided anything for.",
    },
    "status.proposed": {
        text: "Has proposals",
        description: "Status of a story line with at least one translator's proposal; shown as a dot by the line number.",
    },
    "status.approved": {
        text: "Approved",
        description: "Status of a story line whose translation the lead approved.",
    },
    "status.outdated": {
        text: "Outdated",
        description: "Status of a decision made for an English text the story no longer has at that place (it changed in an import).",
    },
    "approved.label": {
        text: "Approved by {name}, {date}",
        description: "Label over the approved translation of a line; name is the lead, date when.",
    },
    "approved.game": {
        text: "Checked as in the game by {name}, {date}",
        description: "Label over a line whose current game translation the lead checked and kept.",
    },
    "keep.by": {
        text: "Keep as in the game: {names}",
        description: "Under the game's Russian of a line: who voted to keep it; names is a comma-separated list, count their number.",
    },
    "proposal.mine": {
        text: "My proposal",
        description: "Author label of the viewer's own proposal for a line.",
    },
    "proposal.edited": {
        text: "edited",
        description: "Marks a proposal that was rewritten after it was first saved.",
    },
    "proposal.from.sova": {
        text: "from Sova's",
        description: "Marks a proposal that started from Sova's translation.",
    },
    "proposal.from.ai": {
        text: "from the AI's",
        description: "Marks a proposal that started from the AI's translation.",
    },
    "proposal.from.kit": {
        text: "from the review kit",
        description: "Marks a proposal that came from the review kit's reports (reserved).",
    },
    "proposal.from.own": {
        text: "own text",
        description: "Marks a proposal written by the translator.",
    },
    "proposal.agreed": {
        text: "{count, plural, one {# agrees} other {# agree}}",
        description: "How many translators agree with a proposal.",
    },
    "proposal.edit": {
        text: "Edit",
        description: "Button under the viewer's own proposal in the story table: opens it in the editor.",
    },
    "proposal.rewrite": {
        text: "Rewrite",
        description: "Button in My edits: opens the proposal's text for rewriting.",
    },
    "proposal.delete": {
        text: "Delete",
        description: "Button deleting the viewer's own proposal.",
    },
    "edit.failedSave": {
        text: "Couldn't save the proposal.",
        description: "Toast when saving a proposal fails.",
    },
    "edit.failedDelete": {
        text: "Couldn't delete the proposal.",
        description: "Toast when deleting a proposal fails.",
    },
    "edit.failedKeep": {
        text: "Couldn't save your vote.",
        description: "Toast when voting to keep the game's translation fails.",
    },
    "edit.notEditable": {
        text: "Nothing to translate here.",
        description: "Shown instead of the edit actions on a line of punctuation only.",
    },
    "outdated.proposal": {
        text: "{name}'s proposal for the previous English",
        description: "Label of a proposal left at a line whose English has since changed; name is its author.",
    },
    "outdated.approval": {
        text: "Approved by {name} for the previous English",
        description: "Label of an approval left at a line whose English has since changed.",
    },
    "outdated.was": {
        text: "Was for: {en}",
        description: "The old English text an outdated decision was made for.",
    },
    "comment.label": {
        text: "Comment on this line",
        description: "Label of the comment box in a story line.",
    },
    "comment.save": {
        text: "Add comment",
        description: "Button saving a new comment.",
    },
    "comment.failed": {
        text: "Couldn't save the comment.",
        description: "Toast when adding, resolving or deleting a comment fails.",
    },
    "comment.resolve": {
        text: "Resolved",
        description: "Button marking a comment as resolved (it then folds away).",
    },
    "comment.reopen": {
        text: "Reopen",
        description: "Button marking a resolved comment as open again.",
    },
    "comment.delete": {
        text: "Delete",
        description: "Button deleting the viewer's own comment.",
    },
    "comment.resolvedBy": {
        text: "resolved by {name}",
        description: "Marks a resolved comment; name is who resolved it.",
    },
    "comment.resolvedCount": {
        text: "{count, plural, one {# resolved comment} other {# resolved comments}}",
        description: "Button that unfolds the resolved comments of a line.",
    },
    "action.write": {
        text: "Write my own",
        description: "Action on a story line: opens the editor filled with the game's Russian.",
    },
    "action.editMine": {
        text: "Edit my proposal",
        description: "Action on a story line where the viewer already has a proposal: opens it in the editor.",
    },
    "action.takeSova": {
        text: "Take Sova's",
        description: "Action on a story line: opens the editor filled with Sova's translation.",
    },
    "action.takeAi": {
        text: "Take the AI's",
        description: "Action on a story line: opens the editor filled with the AI's translation.",
    },
    "action.keep": {
        text: "Keep as in the game",
        description: "Toggle on a story line: the viewer votes that the game's current Russian is good.",
    },
    "action.comment": {
        text: "Comment",
        description: "Action on a story line: opens the comment box.",
    },
    "editor.label": {
        text: "My translation",
        description: "Label of the editor of the viewer's own proposal.",
    },
    "editor.label.sova": {
        text: "My translation, from Sova's",
        description: "Label of the editor when it started from Sova's translation.",
    },
    "editor.label.ai": {
        text: "My translation, from the AI's",
        description: "Label of the editor when it started from the AI's translation.",
    },
    "editor.rewrite": {
        text: "Rewrite my proposal",
        description: "Label of the rewrite box in My edits.",
    },
    "editor.wholeEntry": {
        text: "This is one dictionary entry: the edit saves all its lines together.",
        description: "Under the editor of a multi-line story text.",
    },
    "editor.sameAsGame": {
        text: "This is the game's text as it is. To keep it, use Keep as in the game.",
        description: "Under the editor when the text equals the game's current Russian (saving is off).",
    },
    "editor.save": {
        text: "Save",
        description: "Button saving the proposal.",
    },
    "editor.cancel": {
        text: "Cancel",
        description: "Button closing the editor without saving.",
    },
    "editor.keys": {
        text: "Ctrl+Enter saves, Esc cancels",
        description: "Keyboard hint under the editor.",
    },
    "places.note": {
        text: "This line also stands in {count, plural, one {# other place} other {# other places}}: the edit applies to all.",
        description: "Warning under the editor when the same dictionary entry appears elsewhere in the story.",
    },
    "places.show": {
        text: "Show places",
        description: "Button unfolding the list of the places of a line.",
    },
    "places.load": {
        text: "Couldn't load the places of this line.",
        description: "Load failure of the list of places of a line.",
    },
    "places.item": {
        text: "{group} › {story} · line {n}",
        description: "One place of a line: chapter › story · line number in the story table.",
    },
    "places.itemBare": {
        text: "{story} · line {n}",
        description: "One place of a line whose chapter is unknown.",
    },
    "places.here": {
        text: "this line",
        description: "Marks the current line in the list of its places.",
    },
    "places.more": {
        text: "and {count} more",
        description: "Under a cut list of places.",
    },
    "confirm.title": {
        text: "Save in all {count} places?",
        description: "Heading of the confirmation before an edit of a line that stands in more than 20 places.",
    },
    "confirm.description": {
        text: "The game uses one translation for this English text wherever it appears. Check the places before saving.",
        description: "Text of the confirmation before a wide edit.",
    },
    "confirm.save": {
        text: "Save in {count} places",
        description: "Button confirming a wide edit.",
    },
    "where.item": {
        text: "Story › {group} › {story} › line {n}",
        description: "Where a proposal was made, in My edits.",
    },
    "where.places": {
        text: "in {count} places",
        description: "Under the place in My edits: how many story lines hold the same entry.",
    },
    "history.open": {
        text: "History ({count})",
        description: "Button unfolding the texts a proposal has had; count is how many.",
    },
    "history.label": {
        text: "Texts of this proposal, newest first",
        description: "Accessible name of a proposal's history list.",
    },
    "history.current": {
        text: "current",
        description: "Marks the current text in a proposal's history.",
    },
    "history.load": {
        text: "Couldn't load the history.",
        description: "Load failure of a proposal's history.",
    },
    "state.proposed": {
        text: "Proposed",
        description: "State of a proposal in My edits: waiting for the lead.",
    },
    "state.approved": {
        text: "Approved",
        description: "State of a proposal the lead approved.",
    },
    "state.otherApproved": {
        text: "Another approved",
        description: "State of a proposal when the lead approved another variant for the line.",
    },
    "state.outdated": {
        text: "Outdated",
        description: "State of a proposal whose English is gone from the story since an import.",
    },
    "edits.intro": {
        text: "Your proposals: what the game shows now, what you propose and where.",
        description: "Line at the top of the My edits tab.",
    },
    "edits.all": {
        text: "Everyone's",
        description: "Switch for the lead in My edits: show every translator's proposals.",
    },
    "edits.load": {
        text: "Couldn't load the edits.",
        description: "Load failure of My edits.",
    },
    "edits.empty": {
        text: "No proposals yet",
        description: "Heading of the empty My edits tab.",
    },
    "edits.emptyHint": {
        text: "Open a story and use Write my own or Take Sova's on a line.",
        description: "Hint under the empty My edits heading.",
    },
    "edits.count": {
        text: "{count, plural, one {# proposal} other {# proposals}}",
        description: "Above the My edits table.",
    },
    "edits.tableLabel": {
        text: "Proposals",
        description: "Accessible name of the My edits table.",
    },
    "edits.col.was": {
        text: "Was (in the game)",
        description: "My edits column: the game's Russian now and its English.",
    },
    "edits.col.now": {
        text: "Now (proposed)",
        description: "My edits column: the proposal's text.",
    },
    "edits.col.where": {
        text: "Where",
        description: "My edits column: the place of the proposal.",
    },
    "edits.col.state": {
        text: "State",
        description: "My edits column: proposed, approved, outdated.",
    },
    "edits.col.date": {
        text: "Date",
        description: "My edits column: when the proposal was last saved.",
    },
} satisfies MessageMap;

export const { keys } = defineMessages({ namespace, messages });
