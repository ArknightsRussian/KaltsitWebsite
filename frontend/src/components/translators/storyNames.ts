/**
 * Chapter and story names, from the story library's own index: in Russian
 * as the game shows them (the ArknightsRU dictionaries, through the import)
 * when the section speaks Russian, else in English; "Chapter › Story" for the
 * places of an edit and for My edits.
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { storyIndexQueryOptions } from "#/lib/api/story";
import { useLocale } from "#/lib/i18n";
import { storyLabel } from "#/lib/story/book/book";
import { namesQueryOptions } from "#/lib/translators/api";
import type { StoryEntry } from "#/types/generated/StoryEntry";
import type { StoryGroup } from "#/types/generated/StoryGroup";

/** A name in the section's language: the game's Russian when there is one. */
export type Rename = (en: string) => string;

const SAME: Rename = (en) => en;

/** The game's Russian for the library's names when the section speaks Russian; the English otherwise or when missing. */
export function useRename(): Rename {
    const locale = useLocale();
    const names = useQuery({ ...namesQueryOptions(), enabled: locale === "ru" });
    return useMemo(() => {
        if (locale !== "ru" || !names.data) return SAME;
        const map = new Map(names.data.map((n) => [n.en, n.ru]));
        return (en: string) => map.get(en) ?? en;
    }, [locale, names.data]);
}

export function groupLabel(g: StoryGroup, rename: Rename = SAME): string {
    const first = g.zone?.nameFirst;
    return g.category === "main" && first ? `${rename(first)}: ${rename(g.name)}` : rename(g.name);
}

export function entryLabel(s: Pick<StoryEntry, "code" | "name">, rename: Rename = SAME): string {
    return storyLabel({ code: s.code, name: rename(s.name) });
}

export interface IStoryName {
    groupId: string;
    group: string;
    story: string;
}

/** Look up a story's chapter and name; undefined while the index loads or for an unknown id. */
export function useStoryNames(): (storyId: string) => IStoryName | undefined {
    const index = useQuery(storyIndexQueryOptions("en"));
    const rename = useRename();
    const groups = index.data?.groups;
    const byId = useMemo(() => {
        const out = new Map<string, IStoryName>();
        for (const g of groups ?? []) for (const s of g.stories) out.set(s.id, { groupId: g.id, group: groupLabel(g, rename), story: entryLabel(s, rename) });
        return out;
    }, [groups, rename]);
    return (storyId) => byId.get(storyId);
}
