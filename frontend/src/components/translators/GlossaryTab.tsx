/**
 * The Glossary tab: the team's whole glossary as last downloaded from its
 * Google Sheet, with search, a sheet filter, sorting, and columns worked out
 * over the story (the sheet is never changed): how many lines hold the term,
 * the Russian the game uses for it, how consistent the lines are with the
 * glossary, its Chinese, and its lines on demand. Members can download it
 * again.
 *
 * Counting a term spelled the same as another (`Amiya`, `Amiya (Guard)`,
 * `Amiya (Medic)`): the story's English cannot tell them apart, so the lines
 * are counted once, at the entry without a qualifier (else the first one);
 * the others show "—" with a hint naming it.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, ExternalLink, List, RefreshCw, X } from "lucide-react";
import type React from "react";
import { useId, useMemo, useState } from "react";
import { SearchField } from "#/components/SearchField";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogPanel, DialogPopup, DialogTitle, DialogTrigger } from "#/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle } from "#/components/ui/empty";
import { Label } from "#/components/ui/label";
import { LoadFailed } from "#/components/ui/load-failed";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Skeleton } from "#/components/ui/skeleton";
import { Spinner } from "#/components/ui/spinner";
import { Switch } from "#/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { useFormatters, useT } from "#/lib/i18n";
import type { TypedT } from "#/lib/i18n/messages";
import { glossaryLinesQueryOptions, glossaryQueryOptions, refreshGlossaryFn, translatorsMeQueryOptions } from "#/lib/translators/api";
import type { Glossary } from "#/types/generated/Glossary";
import type { GlossaryTerm } from "#/types/generated/GlossaryTerm";
import { StoryText } from "./StoryText";
import { useStoryNames } from "./storyNames";
import type { messages } from "./translators.messages";

type T = TypedT<typeof messages>;

type SortKey = "sheet" | "en" | "ru" | "count" | "consistency";
const SORTS: readonly SortKey[] = ["sheet", "en", "ru", "count", "consistency"];
const ALL = "__all__";

const PROSE = "whitespace-normal py-1.5 align-top leading-snug";

/** Search over the English (as written and the key), the Russian and the plural, any case, ё = е. */
function fold(s: string): string {
    return s.toLowerCase().replaceAll("ё", "е");
}

function matches(term: GlossaryTerm, q: string): boolean {
    if (!q) return true;
    return [term.en, term.key, term.ru, term.ruPlural ?? "", term.synonyms ?? ""].some((v) => fold(v).includes(q));
}

/** The sheet's name as shown: Sova's copied sheet by what it is. */
function sheetLabel(term: GlossaryTerm, t: T): string {
    return term.fromSova ? t("glossary.sovaSheet") : term.sheet;
}

/** For a term spelled like others, the entry its lines are counted at (itself when it is that one or alone). */
function countedAt(terms: readonly GlossaryTerm[]): Map<number, GlossaryTerm> {
    const groups = new Map<string, GlossaryTerm[]>();
    for (const term of terms) {
        const k = term.caseSensitive ? term.key : term.key.toLowerCase();
        groups.set(k, [...(groups.get(k) ?? []), term]);
    }
    const out = new Map<number, GlossaryTerm>();
    for (const group of groups.values()) {
        const primary = group.find((g) => !g.qualifier) ?? group[0];
        for (const g of group) out.set(g.id, primary);
    }
    return out;
}

/** The share of a term's lines whose Russian holds its form, or null when it is not checked. */
function consistency(term: GlossaryTerm): number | null {
    return term.fromSova || term.checkedLines === 0 ? null : term.foundLines / term.checkedLines;
}

function Freshness({ data, t }: { data: Glossary; t: T }): React.ReactElement {
    const f = useFormatters();
    const when = (s: number) => f.date(s * 1000, { dateStyle: "medium", timeStyle: "short" });
    return (
        <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm">{data.fetchedAt !== null ? t("glossary.copy", { date: when(data.fetchedAt) }) : t("glossary.none")}</p>
            {data.lastError && data.attemptedAt !== null ? (
                <Alert variant="warning">
                    <AlertDescription>
                        {t("glossary.failed", { date: when(data.attemptedAt) })} <span className="text-muted-foreground">{data.lastError}</span>
                    </AlertDescription>
                </Alert>
            ) : null}
        </div>
    );
}

function Notes({ term }: { term: GlossaryTerm }): React.ReactElement {
    return (
        <span className="flex flex-col gap-0.5 text-muted-foreground text-xs">
            {[term.note, term.synonyms, term.comment].filter(Boolean).map((n) => (
                <span key={n}>{n}</span>
            ))}
        </span>
    );
}

function GameVariants({ term, t }: { term: GlossaryTerm; t: T }): React.ReactElement {
    const f = useFormatters();
    if (term.gameVariants.length === 0) return <span className="text-subtle-foreground">—</span>;
    return (
        <ul className="flex flex-col gap-0.5 text-xs">
            {term.gameVariants.map((v) => (
                <li key={v.ru} className="flex items-center gap-1">
                    <span className={v.glossary ? "font-medium" : undefined}>{v.ru}</span>
                    <span className="text-subtle-foreground tabular-nums">{f.number(v.lines)}</span>
                    {v.glossary ? (
                        <span className="inline-flex text-success-foreground" title={t("glossary.variantGlossary")}>
                            <Check className="size-3.5" aria-hidden="true" />
                            <span className="sr-only">{t("glossary.variantGlossary")}</span>
                        </span>
                    ) : null}
                </li>
            ))}
        </ul>
    );
}

/** A term's story lines in a dialog, optionally only those whose Russian lacks the glossary's form. */
function TermLines({ term, t }: { term: GlossaryTerm; t: T }): React.ReactElement {
    const missingId = useId();
    const [missing, setMissing] = useState(false);
    const query = useQuery(glossaryLinesQueryOptions(term.id, missing));
    const me = useQuery(translatorsMeQueryOptions());
    const nameOf = useStoryNames();
    const nickname = me.data?.nickname ?? t("nickname.fallback");
    return (
        <>
            <DialogHeader>
                <DialogTitle>{t("glossary.lines.title", { term: term.key })}</DialogTitle>
                <DialogDescription>{t("glossary.lines.description", { ru: term.ru })}</DialogDescription>
                {term.fromSova ? null : (
                    <label htmlFor={missingId} className="flex items-center gap-2 text-sm">
                        <Switch id={missingId} checked={missing} onCheckedChange={setMissing} />
                        {t("glossary.lines.missing")}
                    </label>
                )}
            </DialogHeader>
            <DialogPanel>
                {query.isError ? (
                    <LoadFailed layout="inline" message={t("glossary.lines.load")} onRetry={() => query.refetch()} />
                ) : !query.data ? (
                    <Skeleton className="h-40 w-full" />
                ) : query.data.lines.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{t("glossary.lines.empty")}</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        <p className="text-subtle-foreground text-xs">{t("glossary.lines.count", { shown: query.data.lines.length, total: query.data.total })}</p>
                        <ul className="flex flex-col gap-2 text-sm">
                            {query.data.lines.map((l) => {
                                const n = nameOf(l.storyId);
                                return (
                                    <li key={`${l.storyId}-${l.ord}`} className="flex flex-col gap-0.5 border-s-2 ps-2">
                                        <span className="flex items-center gap-1 text-xs">
                                            {n ? (
                                                <Link to="/translators" search={{ group: n.groupId, story: l.storyId }} hash={`n-${l.ord + 1}`} className="underline-offset-4 hover:underline">
                                                    {t("places.item", { group: n.group, story: n.story, n: l.ord + 1 })}
                                                </Link>
                                            ) : (
                                                t("places.itemBare", { story: l.storyId, n: l.ord + 1 })
                                            )}
                                            {l.found === true ? <Check className="size-3.5 text-success-foreground" aria-label={t("terms.found")} /> : null}
                                            {l.found === false ? (
                                                <span className="inline-flex items-center gap-0.5 text-warning-foreground">
                                                    <X className="size-3.5" aria-hidden="true" />
                                                    {t("terms.notFound")}
                                                </span>
                                            ) : null}
                                        </span>
                                        {l.ruGame ? <StoryText text={l.ruGame} nickname={nickname} /> : <span className="text-subtle-foreground">{t("ru.missing")}</span>}
                                        <span className="text-muted-foreground text-xs">
                                            <StoryText text={l.en} nickname={nickname} />
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </DialogPanel>
        </>
    );
}

export function GlossaryTab(): React.ReactElement {
    const t: T = useT("translators");
    const f = useFormatters();
    const ids = { sheet: useId(), sort: useId() };
    const queryClient = useQueryClient();
    const query = useQuery(glossaryQueryOptions());
    const refresh = useMutation({
        mutationFn: () => refreshGlossaryFn(),
        onSuccess: (data) => queryClient.setQueryData(glossaryQueryOptions().queryKey, data),
    });
    const [search, setSearch] = useState("");
    const [sheet, setSheet] = useState<string>(ALL);
    const [sort, setSort] = useState<SortKey>("sheet");

    const terms = query.data?.terms;
    const sheets = useMemo(() => [...new Map((terms ?? []).map((term) => [term.sheet, term])).values()], [terms]);
    const counted = useMemo(() => countedAt(terms ?? []), [terms]);
    const shown = useMemo(() => {
        const q = fold(search.trim());
        const list = (terms ?? []).filter((term) => (sheet === ALL || term.sheet === sheet) && matches(term, q));
        const count = (x: GlossaryTerm) => (counted.get(x.id)?.id === x.id ? x.storyLines : -1);
        if (sort === "en") list.sort((a, b) => f.collator.compare(a.key, b.key));
        else if (sort === "ru") list.sort((a, b) => f.collator.compare(a.ru, b.ru));
        else if (sort === "count") list.sort((a, b) => count(b) - count(a) || f.collator.compare(a.key, b.key));
        else if (sort === "consistency") list.sort((a, b) => (consistency(a) ?? 2) - (consistency(b) ?? 2) || count(b) - count(a));
        return list;
    }, [terms, search, sheet, sort, f.collator, counted]);

    if (query.isError) return <LoadFailed message={t("glossary.load")} onRetry={() => query.refetch()} />;
    if (!query.data) return <Skeleton className="h-96 w-full rounded-2xl" />;
    const data = query.data;
    const busy = data.refreshing || refresh.isPending;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <Freshness data={data} t={t} />
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-subtle-foreground text-xs">{t("glossary.readOnly")}</span>
                    <Button
                        variant="outline"
                        size="sm"
                        render={
                            <a href={data.sheetUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink aria-hidden="true" />
                                {t("glossary.open")}
                            </a>
                        }
                    />
                    <Button size="sm" onClick={() => refresh.mutate()} disabled={busy}>
                        {busy ? <Spinner /> : <RefreshCw aria-hidden="true" />}
                        {busy ? t("glossary.refreshing") : t("glossary.refresh")}
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap items-end gap-4">
                <SearchField className="w-full sm:w-80" value={search} onChange={setSearch} placeholder={t("glossary.search")} label={t("glossary.searchLabel")} clearLabel={t("glossary.clear")} />
                <div className="flex w-full flex-col gap-1.5 sm:w-64">
                    <Label htmlFor={ids.sheet}>{t("glossary.sheet")}</Label>
                    <Select value={sheet} onValueChange={(v: string | null) => setSheet(v ?? ALL)}>
                        <SelectTrigger id={ids.sheet}>
                            <SelectValue>{() => (sheet === ALL ? t("glossary.sheetAll") : sheetLabel(sheets.find((s) => s.sheet === sheet) ?? sheets[0], t))}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>{t("glossary.sheetAll")}</SelectItem>
                            {sheets.map((s) => (
                                <SelectItem key={s.sheet} value={s.sheet}>
                                    {sheetLabel(s, t)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex w-full flex-col gap-1.5 sm:w-64">
                    <Label htmlFor={ids.sort}>{t("glossary.sort")}</Label>
                    <Select value={sort} onValueChange={(v: string | null) => v && setSort(v as SortKey)}>
                        <SelectTrigger id={ids.sort}>
                            <SelectValue>{() => t(`glossary.sort.${sort}` as "glossary.sort.sheet")}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {SORTS.map((s) => (
                                <SelectItem key={s} value={s}>
                                    {t(`glossary.sort.${s}` as "glossary.sort.sheet")}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <p className="text-subtle-foreground text-xs">{t("glossary.summary", { shown: shown.length, total: data.terms.length })}</p>

            {shown.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>{data.terms.length === 0 ? t("glossary.none") : t("glossary.empty")}</EmptyTitle>
                    </EmptyHeader>
                </Empty>
            ) : (
                <Table aria-label={t("glossary.tableLabel")}>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t("glossary.col.en")}</TableHead>
                            <TableHead>{t("glossary.col.ru")}</TableHead>
                            <TableHead>{t("glossary.col.game")}</TableHead>
                            <TableHead className="text-right">{t("glossary.col.consistency")}</TableHead>
                            <TableHead>{t("glossary.col.cn")}</TableHead>
                            <TableHead>{t("glossary.sheet")}</TableHead>
                            <TableHead>{t("glossary.col.notes")}</TableHead>
                            <TableHead className="text-right">{t("glossary.col.count")}</TableHead>
                            <TableHead>
                                <span className="sr-only">{t("glossary.showLines")}</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {shown.map((term) => {
                            const at = counted.get(term.id);
                            const own = !at || at.id === term.id;
                            const share = consistency(term);
                            const shared = <span title={t("glossary.sharedHint", { key: at?.en ?? term.key })}>—</span>;
                            return (
                                <TableRow key={term.id}>
                                    <TableCell className={PROSE}>
                                        <span className="flex flex-col gap-0.5">
                                            <span className="font-medium">
                                                {term.key}
                                                {term.qualifier ? <span className="text-muted-foreground"> ({term.qualifier})</span> : null}
                                            </span>
                                            {term.en !== term.key && term.en !== `${term.key} (${term.qualifier})` ? <span className="text-subtle-foreground text-xs">{term.en}</span> : null}
                                        </span>
                                    </TableCell>
                                    <TableCell className={PROSE}>
                                        <span className="flex flex-col gap-0.5">
                                            <span>{term.ru}</span>
                                            {term.ruPlural ? <span className="text-muted-foreground text-xs">{t("glossary.plural", { form: term.ruPlural })}</span> : null}
                                        </span>
                                    </TableCell>
                                    <TableCell className={PROSE}>{own ? <GameVariants term={term} t={t} /> : shared}</TableCell>
                                    <TableCell className="py-1.5 text-right align-top tabular-nums">
                                        {!own ? shared : share === null ? <span className="text-subtle-foreground">—</span> : <span title={t("glossary.consistencyHint", { found: term.foundLines, checked: term.checkedLines })}>{f.percent(share)}</span>}
                                    </TableCell>
                                    <TableCell className={PROSE}>{term.cn ? <span>{term.cn}</span> : term.cnGame ? <span title={t("glossary.cnFromGame")}>{term.cnGame}</span> : <span className="text-subtle-foreground">—</span>}</TableCell>
                                    <TableCell className={PROSE}>
                                        <span className="flex flex-col items-start gap-0.5 text-xs">
                                            {term.fromSova ? (
                                                <Badge variant="tint" size="sm" style={{ "--tone": "var(--dmg-physic)" } as React.CSSProperties}>
                                                    {t("glossary.sovaSheet")}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">{term.sheet}</span>
                                            )}
                                        </span>
                                    </TableCell>
                                    <TableCell className={PROSE}>
                                        <Notes term={term} />
                                    </TableCell>
                                    <TableCell className="py-1.5 text-right align-top text-muted-foreground tabular-nums">{own ? f.number(term.storyLines) : shared}</TableCell>
                                    <TableCell className="py-1 align-top">
                                        {term.storyLines > 0 ? (
                                            <Dialog>
                                                <DialogTrigger render={<Button variant="ghost" size="xs" />}>
                                                    <List aria-hidden="true" />
                                                    {t("glossary.showLines")}
                                                </DialogTrigger>
                                                <DialogPopup className="max-w-3xl">
                                                    <TermLines term={term} t={t} />
                                                </DialogPopup>
                                            </Dialog>
                                        ) : null}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            )}
        </div>
    );
}
