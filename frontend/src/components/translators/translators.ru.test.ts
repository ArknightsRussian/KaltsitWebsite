import { describe, expect, it } from "vitest";
import { formatMessage } from "#/lib/i18n";
import { messages } from "./translators.messages";
import ru from "./translators.ru.json";

/** The plain `{name}` arguments of an ICU message (plural branches skipped). */
function args(text: string): string[] {
    return [...new Set([...text.matchAll(/\{(\w+)(?=[,}])/g)].map((m) => m[1]))].sort();
}

describe("the section's Russian", () => {
    const ruTexts = ru as Record<string, string>;

    it("translates every key of the section and nothing else", () => {
        expect(Object.keys(ruTexts).sort()).toEqual(Object.keys(messages).sort());
    });

    it("keeps each message's arguments", () => {
        for (const [key, m] of Object.entries(messages)) expect([key, args(ruTexts[key])]).toEqual([key, args(m.text)]);
    });

    it("formats Russian plurals", () => {
        expect(formatMessage(ruTexts["edits.count"], "ru", { count: 1 })).toBe("1 предложение");
        expect(formatMessage(ruTexts["edits.count"], "ru", { count: 3 })).toBe("3 предложения");
        expect(formatMessage(ruTexts["edits.count"], "ru", { count: 5 })).toBe("5 предложений");
    });
});
