/**
 * THE TRANSLATORS' READER (`/translators`): pick a chapter and a story, read
 * its lines as English | Russian as the game shows it now | Chinese. Read only.
 * The chapter list is the story library's own index; the lines come from the
 * section's import (`/api/translators`).
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import type React from "react";
import { useId, useMemo } from "react";
import { Button } from "#/components/ui/button";
import { Combobox, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxPopup } from "#/components/ui/combobox";
import { Empty, EmptyHeader, EmptyTitle } from "#/components/ui/empty";
import { Label } from "#/components/ui/label";
import { LoadFailed } from "#/components/ui/load-failed";
import { PageHeader } from "#/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Skeleton } from "#/components/ui/skeleton";
import { Switch } from "#/components/ui/switch";
import { Tabs, TabsList, TabsPanel, TabsTab } from "#/components/ui/tabs";
import { storyIndexQueryOptions } from "#/lib/api/story";
import { useT } from "#/lib/i18n";
import type { TypedT } from "#/lib/i18n/messages";
import { storyLabel } from "#/lib/story/book/book";
import { resolveNickname, useStorySettings } from "#/lib/story/settings";
import { translatorLinesQueryOptions, translatorsMeQueryOptions } from "#/lib/translators/api";
import type { StoryGroup } from "#/types/generated/StoryGroup";
import { LinesTable } from "./LinesTable";
import type { messages } from "./translators.messages";

type T = TypedT<typeof messages>;

export interface ITranslatorsSearch {
    group?: string;
    story?: string;
    cn?: boolean;
}

interface IGroupItem {
    id: string;
    label: string;
    kind: string;
}

function groupLabel(g: StoryGroup): string {
    const first = g.zone?.nameFirst;
    return g.category === "main" && first ? `${first}: ${g.name}` : g.name;
}

function Lines({ storyId, title, showCn, t }: { storyId: string; title: string; showCn: boolean; t: T }): React.ReactElement {
    const query = useQuery(translatorLinesQueryOptions(storyId));
    const [settings] = useStorySettings();
    const nickname = resolveNickname(settings.nickname);
    if (query.isError) return <LoadFailed message={t("load.lines")} onRetry={() => query.refetch()} />;
    if (!query.data) return <Skeleton className="h-96 w-full rounded-2xl" />;
    const { lines, importedAt } = query.data;
    if (importedAt === null)
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>{t("empty.notImported")}</EmptyTitle>
                </EmptyHeader>
            </Empty>
        );
    if (lines.length === 0)
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>{t("empty.noLines")}</EmptyTitle>
                </EmptyHeader>
            </Empty>
        );
    const withRu = lines.filter((l) => l.ruGame).length;
    return (
        <div className="flex flex-col gap-2">
            <p className="text-subtle-foreground text-xs">{t("table.summary", { count: lines.length, ru: withRu })}</p>
            <LinesTable lines={lines} label={t("table.label", { story: title })} showCn={showCn} nickname={nickname} />
        </div>
    );
}

export function TranslatorsPage({ search, onSearch }: { search: ITranslatorsSearch; onSearch: (next: ITranslatorsSearch) => void }): React.ReactElement {
    const t: T = useT("translators");
    const ids = { chapter: useId(), story: useId(), cn: useId() };
    const index = useQuery(storyIndexQueryOptions("en"));
    const me = useQuery(translatorsMeQueryOptions());

    const groups = index.data?.groups ?? [];
    const items: IGroupItem[] = useMemo(() => groups.map((g) => ({ id: g.id, label: groupLabel(g), kind: g.category })), [groups]);
    const group = groups.find((g) => g.id === search.group) ?? null;
    const groupItem = items.find((i) => i.id === search.group) ?? null;
    const stories = useMemo(() => (group ? [...group.stories].sort((a, b) => a.sort - b.sort) : []), [group]);
    const story = stories.find((s) => s.id === search.story) ?? null;
    const showCn = search.cn === true;

    return (
        <div className="page-shell flex flex-col gap-6">
            <PageHeader
                title={t("page.title")}
                description={t("page.description")}
                actions={
                    me.data?.devLogin && !me.data.member ? (
                        <Button variant="outline" size="sm" render={<Link to="/translators/dev-login" />}>
                            {t("devLogin.link")}
                        </Button>
                    ) : null
                }
            />

            <Tabs value="story">
                <TabsList aria-label={t("tabs.label")}>
                    <TabsTab value="story">{t("tabs.story")}</TabsTab>
                </TabsList>
                <TabsPanel value="story" className="flex flex-col gap-6 pt-4">
                    {index.isError ? (
                        <LoadFailed message={t("load.index")} onRetry={() => index.refetch()} />
                    ) : (
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="flex w-full flex-col gap-1.5 sm:w-80">
                                <Label htmlFor={ids.chapter}>{t("picker.chapter")}</Label>
                                <Combobox<IGroupItem, false> items={items} value={groupItem} onValueChange={(v) => v && onSearch({ ...search, group: v.id, story: undefined })} itemToStringLabel={(i) => i.label} itemToStringValue={(i) => i.id}>
                                    <ComboboxInput id={ids.chapter} placeholder={t("picker.chapterPlaceholder", { count: items.length })} disabled={!index.data} />
                                    <ComboboxPopup>
                                        <ComboboxEmpty>{t("picker.chapterEmpty")}</ComboboxEmpty>
                                        <ComboboxList>
                                            {(item: IGroupItem) => (
                                                <ComboboxItem key={item.id} value={item}>
                                                    <span className="flex min-w-0 flex-col">
                                                        <span className="truncate">{item.label}</span>
                                                        <span className="text-subtle-foreground text-xs">{t(`category.${item.kind}` as "category.main")}</span>
                                                    </span>
                                                </ComboboxItem>
                                            )}
                                        </ComboboxList>
                                    </ComboboxPopup>
                                </Combobox>
                            </div>

                            <div className="flex w-full flex-col gap-1.5 sm:w-80">
                                <Label htmlFor={ids.story}>{t("picker.story")}</Label>
                                <Select value={story?.id ?? null} onValueChange={(v: string | null) => v && onSearch({ ...search, story: v })} disabled={!group}>
                                    <SelectTrigger id={ids.story}>
                                        <SelectValue placeholder={t("picker.storyPlaceholder")}>{() => (story ? storyLabel(story) : t("picker.storyPlaceholder"))}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {stories.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {storyLabel(s)}
                                                {s.avgTag ? <span className="text-subtle-foreground"> · {s.avgTag}</span> : null}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <label htmlFor={ids.cn} className="flex items-center gap-3">
                                <Switch id={ids.cn} checked={showCn} onCheckedChange={(checked: boolean) => onSearch({ ...search, cn: checked || undefined })} />
                                <span className="flex flex-col gap-0.5">
                                    <span className="font-medium text-sm">{t("toggle.cn")}</span>
                                    <span className="text-muted-foreground text-xs">{t("toggle.cnHint")}</span>
                                </span>
                            </label>

                            {story ? (
                                <Button variant="ghost" size="sm" render={<Link to="/stories/$storyId" params={{ storyId: story.id }} search={{ view: "book" }} />}>
                                    <BookOpen />
                                    {t("book.open")}
                                </Button>
                            ) : null}
                        </div>
                    )}

                    {me.data && !me.data.member ? <p className="text-muted-foreground text-sm">{t("hints.signedOut")}</p> : null}

                    {story ? (
                        <Lines storyId={story.id} title={storyLabel(story)} showCn={showCn} t={t} />
                    ) : (
                        <Empty>
                            <EmptyHeader>
                                <EmptyTitle>{t("empty.choose")}</EmptyTitle>
                            </EmptyHeader>
                        </Empty>
                    )}
                </TabsPanel>
            </Tabs>
        </div>
    );
}
