/**
 * The Glossary tab: the team's whole glossary as last downloaded from its
 * Google Sheet, with search, a sheet filter, sorting and how many story lines
 * hold each term. Read only: the sheet is where the team edits it; members
 * can download it again.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw } from "lucide-react";
import type React from "react";
import { useId, useMemo, useState } from "react";
import { SearchField } from "#/components/SearchField";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "#/components/ui/empty";
import { Label } from "#/components/ui/label";
import { LoadFailed } from "#/components/ui/load-failed";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Skeleton } from "#/components/ui/skeleton";
import { Spinner } from "#/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { useFormatters, useT } from "#/lib/i18n";
import type { TypedT } from "#/lib/i18n/messages";
import { glossaryQueryOptions, refreshGlossaryFn } from "#/lib/translators/api";
import type { Glossary } from "#/types/generated/Glossary";
import type { GlossaryTerm } from "#/types/generated/GlossaryTerm";
import type { messages } from "./translators.messages";

type T = TypedT<typeof messages>;

type SortKey = "sheet" | "en" | "ru" | "count";
const SORTS: readonly SortKey[] = ["sheet", "en", "ru", "count"];
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
    const sheets = useMemo(() => [...new Set((terms ?? []).map((term) => term.sheet))], [terms]);
    const shown = useMemo(() => {
        const q = fold(search.trim());
        const list = (terms ?? []).filter((term) => (sheet === ALL || term.sheet === sheet) && matches(term, q));
        if (sort === "en") list.sort((a, b) => f.collator.compare(a.key, b.key));
        else if (sort === "ru") list.sort((a, b) => f.collator.compare(a.ru, b.ru));
        else if (sort === "count") list.sort((a, b) => b.storyLines - a.storyLines || f.collator.compare(a.key, b.key));
        return list;
    }, [terms, search, sheet, sort, f.collator]);

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
                            <SelectValue>{() => (sheet === ALL ? t("glossary.sheetAll") : sheet)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>{t("glossary.sheetAll")}</SelectItem>
                            {sheets.map((s) => (
                                <SelectItem key={s} value={s}>
                                    {s}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex w-full flex-col gap-1.5 sm:w-56">
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
                            <TableHead>{t("glossary.sheet")}</TableHead>
                            <TableHead>{t("glossary.col.notes")}</TableHead>
                            <TableHead className="text-right">{t("glossary.col.count")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {shown.map((term) => (
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
                                <TableCell className={PROSE}>
                                    <span className="flex flex-col items-start gap-0.5 text-xs">
                                        <span className="text-muted-foreground">{term.sheet}</span>
                                        {term.fromSova ? (
                                            <Badge variant="tint" size="sm" style={{ "--tone": "var(--info)" } as React.CSSProperties}>
                                                {t("terms.variant")}
                                            </Badge>
                                        ) : null}
                                    </span>
                                </TableCell>
                                <TableCell className={PROSE}>
                                    <Notes term={term} />
                                </TableCell>
                                <TableCell className="py-1.5 text-right align-top text-muted-foreground tabular-nums">{f.number(term.storyLines)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    );
}
