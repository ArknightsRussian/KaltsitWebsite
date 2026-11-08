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
        text: "Story text side by side: English, Russian as the game shows it now with the ArknightsRU pack, and the Chinese original. Read only.",
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
    "glossary.caseSensitive": {
        text: "Capitalised only",
        description: "Mark on a term that is found in the English only as capitalised (names, classes, races).",
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
} satisfies MessageMap;

export const { keys } = defineMessages({ namespace, messages });
