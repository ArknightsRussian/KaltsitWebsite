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
    "book.open": {
        text: "Book view",
        description: "Link that opens the chosen story in the site's book view.",
    },
    "table.label": {
        text: "Lines of {story}",
        description: "Accessible name of the lines table; story is the story's title.",
    },
    "table.line": { text: "Line", description: "Column: line number in the English script." },
    "table.speaker": { text: "Speaker", description: "Column: who says the line." },
    "table.en": { text: "English", description: "Column: the English text." },
    "table.ru": { text: "Russian (in game)", description: "Column: the Russian the game shows now." },
    "table.cn": { text: "Chinese", description: "Column: the Chinese original." },
    "table.summary": {
        text: "{count, plural, one {# line} other {# lines}}, {ru} with Russian",
        description: "Count above the lines table; ru is how many have a Russian text.",
    },
    "line.option": {
        text: "Option {part}",
        description: "Label of a reply option of a decision in the lines table.",
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
    "hints.show": {
        text: "Show variants",
        description: "Accessible name of the button that opens Sova's and the AI's variants of a line.",
    },
    "hints.hide": {
        text: "Hide variants",
        description: "Accessible name of the same button when the variants are open.",
    },
    "hints.sova": { text: "Sova", description: "Label of Sova's translation of a line." },
    "hints.ai": { text: "AI", description: "Label of the machine translation of a line." },
    "hints.dict": {
        text: "Dictionary (overridden by the plugin)",
        description: "Label of the dictionary's own Russian when the plugin shows a different one.",
    },
    "hints.signedOut": {
        text: "Sova's and AI variants are shown to signed-in translators.",
        description: "Note above the table for a visitor who is not a signed-in translator.",
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
