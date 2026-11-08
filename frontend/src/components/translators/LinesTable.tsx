/**
 * One story's lines as a table: speaker | English | Russian as in the game |
 * Chinese (optional). A row with variants (Sova, AI, or the dictionary's own
 * text under a plugin override) opens them under itself.
 */
import { ChevronDown } from "lucide-react";
import type React from "react";
import { Fragment, useState } from "react";
import { renderStoryNodes } from "#/components/story/reader/TextBox";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { InfoHint } from "#/components/ui/info-hint";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { useT } from "#/lib/i18n";
import type { TypedT } from "#/lib/i18n/messages";
import { renderLine } from "#/lib/story/text";
import { cn } from "#/lib/utils";
import type { TranslatorLine } from "#/types/generated/TranslatorLine";
import type { messages } from "./translators.messages";

type T = TypedT<typeof messages>;

/** The kit cell is one nowrap, middle-aligned line; a prose cell wraps, reads from the top and keeps a reading line height. */
const PROSE = "whitespace-normal align-top leading-relaxed";

function StoryText({ text, nickname }: { text: string; nickname: string }): React.ReactElement {
    return <span className="whitespace-pre-line">{renderStoryNodes(renderLine(text, nickname))}</span>;
}

function hasVariants(line: TranslatorLine): boolean {
    return Boolean(line.sova || line.ai || line.ruDict);
}

function Speaker({ line, t }: { line: TranslatorLine; t: T }): React.ReactElement | null {
    if (line.kind === "option") return <span className="text-muted-foreground">{t("line.option", { part: line.part })}</span>;
    if (line.kind === "subtitle") return <span className="text-muted-foreground">{t("line.subtitle")}</span>;
    if (line.kind === "sticker") return <span className="text-muted-foreground">{t("line.sticker")}</span>;
    if (!line.speakerEn) return null;
    return (
        <span className="flex flex-col">
            <span className="font-medium">{line.speakerEn}</span>
            {line.speakerRu && line.speakerRu !== line.speakerEn ? <span className="text-muted-foreground">{line.speakerRu}</span> : null}
        </span>
    );
}

function RuCell({ line, nickname, t }: { line: TranslatorLine; nickname: string; t: T }): React.ReactElement {
    return (
        <div className="flex flex-col gap-1.5">
            {line.ruGame ? <StoryText text={line.ruGame} nickname={nickname} /> : <span className="text-subtle-foreground">{t("ru.missing")}</span>}
            {line.pluginRole === "story" ? (
                <span className="flex items-center gap-1">
                    <Badge variant="warning" size="sm">
                        {t("plugin.badge")}
                    </Badge>
                    <InfoHint label={t("plugin.hint")}>{t("plugin.hint")}</InfoHint>
                </span>
            ) : null}
            {line.pluginRole === "ambiguous:story" ? (
                <span className="flex items-center gap-1">
                    <Badge variant="warning" size="sm">
                        {t("ambiguous.badge")}
                    </Badge>
                    <InfoHint label={t("ambiguous.hint")}>{t("ambiguous.hint")}</InfoHint>
                </span>
            ) : null}
            {line.ruGameMatch === "lines" ? <span className="text-subtle-foreground text-xs">{t("ru.lineByLine")}</span> : null}
        </div>
    );
}

function Variants({ line, nickname, t }: { line: TranslatorLine; nickname: string; t: T }): React.ReactElement {
    const items: { label: string; text: string }[] = [];
    if (line.sova) items.push({ label: t("hints.sova"), text: line.sova });
    if (line.ai) items.push({ label: t("hints.ai"), text: line.ai });
    if (line.ruDict) items.push({ label: t("hints.dict"), text: line.ruDict });
    return (
        <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[max-content_1fr]">
            {items.map((item) => (
                <Fragment key={item.label}>
                    <dt className="text-muted-foreground">{item.label}</dt>
                    <dd>
                        <StoryText text={item.text} nickname={nickname} />
                    </dd>
                </Fragment>
            ))}
        </dl>
    );
}

export function LinesTable({ lines, label, showCn, nickname }: { lines: readonly TranslatorLine[]; label: string; showCn: boolean; nickname: string }): React.ReactElement {
    const t: T = useT("translators");
    const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
    const toggle = (id: string) =>
        setOpen((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const columns = showCn ? 6 : 5;
    return (
        <Table aria-label={label}>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-12">{t("table.line")}</TableHead>
                    <TableHead className="w-36">{t("table.speaker")}</TableHead>
                    <TableHead>{t("table.en")}</TableHead>
                    <TableHead>{t("table.ru")}</TableHead>
                    {showCn ? <TableHead>{t("table.cn")}</TableHead> : null}
                    <TableHead className="w-10">
                        <span className="sr-only">{t("hints.show")}</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {lines.map((line) => {
                    const id = `${line.line}.${line.part}`;
                    const expandable = hasVariants(line);
                    const isOpen = expandable && open.has(id);
                    return (
                        <Fragment key={id}>
                            <TableRow className={cn(isOpen && "border-b-0")} data-line={line.line}>
                                <TableCell className="pt-3 align-top font-mono text-subtle-foreground text-xs tabular-nums">{line.line}</TableCell>
                                <TableCell className={PROSE}>
                                    <Speaker line={line} t={t} />
                                </TableCell>
                                <TableCell className={PROSE}>
                                    <StoryText text={line.en} nickname={nickname} />
                                </TableCell>
                                <TableCell className={PROSE}>
                                    <RuCell line={line} nickname={nickname} t={t} />
                                </TableCell>
                                {showCn ? (
                                    <TableCell className={PROSE}>
                                        {line.speakerCn ? <span className="block text-muted-foreground">{line.speakerCn}</span> : null}
                                        {line.cn ? <span className="whitespace-pre-line">{line.cn.replaceAll("\\n", "\n")}</span> : null}
                                    </TableCell>
                                ) : null}
                                <TableCell className="align-top">
                                    {expandable ? (
                                        <Button variant="ghost" size="icon-sm" aria-expanded={isOpen} aria-label={isOpen ? t("hints.hide") : t("hints.show")} data-pressed={isOpen || undefined} onClick={() => toggle(id)}>
                                            <ChevronDown className={cn("transition-transform", isOpen && "rotate-180")} />
                                        </Button>
                                    ) : null}
                                </TableCell>
                            </TableRow>
                            {isOpen ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell />
                                    <TableCell colSpan={columns - 1} className={cn(PROSE, "pt-0")}>
                                        <Variants line={line} nickname={nickname} t={t} />
                                    </TableCell>
                                </TableRow>
                            ) : null}
                        </Fragment>
                    );
                })}
            </TableBody>
        </Table>
    );
}
