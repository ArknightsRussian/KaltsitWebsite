/**
 * Chapter and story names for a story id, from the story library's own
 * index: "Chapter › Story" for the places of an edit and for My edits.
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { storyIndexQueryOptions } from "#/lib/api/story";
import { storyLabel } from "#/lib/story/book/book";
import type { StoryGroup } from "#/types/generated/StoryGroup";

export function groupLabel(g: StoryGroup): string {
    const first = g.zone?.nameFirst;
    return g.category === "main" && first ? `${first}: ${g.name}` : g.name;
}

export interface IStoryName {
    groupId: string;
    group: string;
    story: string;
}

/** Look up a story's chapter and name; undefined while the index loads or for an unknown id. */
export function useStoryNames(): (storyId: string) => IStoryName | undefined {
    const index = useQuery(storyIndexQueryOptions("en"));
    const groups = index.data?.groups;
    const byId = useMemo(() => {
        const out = new Map<string, IStoryName>();
        for (const g of groups ?? []) for (const s of g.stories) out.set(s.id, { groupId: g.id, group: groupLabel(g), story: storyLabel(s) });
        return out;
    }, [groups]);
    return (storyId) => byId.get(storyId);
}
