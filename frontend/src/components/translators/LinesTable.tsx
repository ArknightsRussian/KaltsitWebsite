/**
 * One story's lines as a dense table: # | speaker | Russian as in the game |
 * English | Chinese (optional). Under the Russian: the glossary terms of the
 * line's English with whether the Russian holds their form, then the
 * variants (Sova, the AI, the dictionary under a plugin override), each in
 * its own tone. With Service on, the script's line numbers and its stage
 * commands sit between the lines as gray rows. Editing (LineEdits.tsx): the
 * approved variant above, the proposals and comments under the Russian, the
 * row's actions and the in-row editor at the bottom of the cell.
 */
import { Check, X } from "lucide-react";
import type React from "react";
import { Fragment, useMemo, useState } from "react";
import { renderStoryNodes } from "#/components/story/reader/TextBox";
import { Badge } from "#/components/ui/badge";
import { InfoHint } from "#/components/ui/info-hint";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { useT } from "#/lib/i18n";
import type { TypedT } from "#/lib/i18n/messages";
import { renderLine } from "#/lib/story/text";
import { cn } from "#/lib/utils";
import type { KeyEdits } from "#/types/generated/KeyEdits";
import type { LineTerm } from "#/types/generated/LineTerm";
import type { OutdatedEdit } from "#/types/generated/OutdatedEdit";
import type { StoryCommand } from "#/types/generated/StoryCommand";
import type { TranslatorLine } from "#/types/generated/TranslatorLine";
import type { TranslatorsMe } from "#/types/generated/TranslatorsMe";
import { ApprovedVariant, CommentEditor, Comments, type EditorState, GameKeepers, LineActions, OutdatedHere, ProposalEditor, Proposals, placeOf, StatusDot } from "./LineEdits";
import type { messages } from "./translators.messages";

type T = TypedT<typeof messages>;

/** A prose cell wraps, reads from the top and stays dense (the kit cell is one nowrap line). */
const PROSE = "whitespace-normal py-1.5 align-top leading-snug";

/**
 * The tone of each variant under the Russian: a border in a status or data
 * colour from the project's tokens, the text stays foreground. `comment` is
 * kept for the reviewers' remarks to come.
 */
const VARIANT_TONE = {
    sova: "var(--info)",
    ai: "var(--dmg-magic)",
    dict: "var(--warning)",
    comment: "var(--muted-foreground)",
} as const;

/** The command kinds the import turns into lines; every other kind is a stage command. */
const DISPLAYED_KINDS = new Set(["name", "multiline", "text", "narration", "dialog", "voicewithin", "subtitle", "sticker", "decision"]);

function StoryText({ text, nickname }: { text: string; nickname: string }): React.ReactElement {
    return <span className="whitespace-pre-line">{renderStoryNodes(renderLine(text, nickname))}</span>;
}

function Speaker({ line, t }: { line: TranslatorLine; t: T }): React.ReactElement | null {
    if (line.kind === "option")
        return (
            <Badge variant="tint" size="sm">
                {t("line.option", { part: line.part })}
            </Badge>
        );
    if (line.kind === "subtitle") return <span className="text-muted-foreground">{t("line.subtitle")}</span>;
    if (line.kind === "sticker") return <span className="text-muted-foreground">{t("line.sticker")}</span>;
    if (!line.speakerEn) return null;
    const ru = line.speakerRu && line.speakerRu !== line.speakerEn ? line.speakerRu : null;
    return (
        <span className="flex flex-col">
            <span className="font-medium">{ru ?? line.speakerEn}</span>
            {ru ? <span className="text-muted-foreground text-xs">{line.speakerEn}</span> : null}
        </span>
    );
}

interface ITermGroup {
    matched: string;
    ru: string[];
    /** true / false when checked; null for Sova's sheet or a line without Russian. */
    found: boolean | null;
    fromSova: boolean;
    title: string;
}

/** One entry per English text found: a key with several rows (`Amiya (Guard)`, `Amiya (Medic)`) shows all their Russian. */
function groupTerms(terms: readonly LineTerm[]): ITermGroup[] {
    const out = new Map<string, ITermGroup>();
    for (const term of terms) {
        let g = out.get(term.matched);
        if (!g) {
            g = { matched: term.matched, ru: [], found: null, fromSova: true, title: "" };
            out.set(term.matched, g);
        }
        if (!g.ru.includes(term.ru)) g.ru.push(term.ru);
        if (!term.fromSova) g.fromSova = false;
        if (term.found === true) g.found = true;
        else if (term.found === false && g.found === null) g.found = false;
        const about = [term.sheet, term.ruPlural, term.note].filter(Boolean).join(" · ");
        g.title = g.title ? `${g.title}\n${about}` : about;
    }
    return [...out.values()];
}

function Terms({ terms, t }: { terms: readonly LineTerm[]; t: T }): React.ReactElement | null {
    if (terms.length === 0) return null;
    return (
        <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" aria-label={t("terms.label")}>
            {groupTerms(terms).map((g) => (
                <li key={g.matched} className="inline-flex items-center gap-1" title={g.title}>
                    <span className="text-muted-foreground">{g.matched}</span>
                    <span className="text-subtle-foreground" aria-hidden="true">
                        →
                    </span>
                    <span>{g.ru.join(" / ")}</span>
                    {g.found === true ? (
                        <span className="inline-flex text-success-foreground">
                            <Check className="size-3.5" aria-hidden="true" />
                            <span className="sr-only">{t("terms.found")}</span>
                        </span>
                    ) : g.found === false ? (
                        <span className="inline-flex items-center gap-0.5 text-warning-foreground">
                            <X className="size-3.5" aria-hidden="true" />
                            {t("terms.notFound")}
                        </span>
                    ) : g.fromSova ? (
                        <span className="text-subtle-foreground">({t("terms.variant")})</span>
                    ) : null}
                </li>
            ))}
        </ul>
    );
}

function Variant({ tone, label, text, nickname }: { tone: keyof typeof VARIANT_TONE; label: string; text: string; nickname: string }): React.ReactElement {
    return (
        <div className="border-(--tone) border-s-2 ps-2" style={{ "--tone": VARIANT_TONE[tone] } as React.CSSProperties} data-variant={tone}>
            <span className="me-1.5 text-subtle-foreground text-xs">{label}</span>
            <StoryText text={text} nickname={nickname} />
        </div>
    );
}

interface IRuCellProps {
    line: TranslatorLine;
    storyId: string;
    nickname: string;
    showVariants: boolean;
    edits: KeyEdits | undefined;
    outdated: readonly OutdatedEdit[];
    me: TranslatorsMe;
    editor: EditorState | null;
    onEditor: (state: EditorState | null) => void;
    t: T;
}

function RuCell({ line, storyId, nickname, showVariants, edits, outdated, me, editor, onEditor, t }: IRuCellProps): React.ReactElement {
    const place = placeOf(storyId, line);
    return (
        <div className="flex flex-col gap-1">
            <ApprovedVariant edits={edits} t={t} />
            {line.ruGame ? <StoryText text={line.ruGame} nickname={nickname} /> : <span className="text-subtle-foreground">{t("ru.missing")}</span>}
            <GameKeepers edits={edits} t={t} />
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
            <Terms terms={line.terms} t={t} />
            <Proposals edits={edits} me={me} onEdit={(p) => onEditor({ kind: "proposal", text: p.text, source: p.source === "sova" || p.source === "ai" ? p.source : "own" })} t={t} />
            {showVariants ? (
                <>
                    {line.sova ? <Variant tone="sova" label={t("hints.sova")} text={line.sova} nickname={nickname} /> : null}
                    {line.ai ? <Variant tone="ai" label={t("hints.ai")} text={line.ai} nickname={nickname} /> : null}
                    {line.ruDict ? <Variant tone="dict" label={t("hints.dict")} text={line.ruDict} nickname={nickname} /> : null}
                </>
            ) : null}
            <OutdatedHere items={outdated} t={t} />
            <Comments edits={edits} me={me} t={t} />
            {editor?.kind === "proposal" ? <ProposalEditor line={line} place={place} initial={editor.text} source={editor.source} onClose={() => onEditor(null)} t={t} /> : null}
            {editor?.kind === "comment" ? <CommentEditor place={place} onClose={() => onEditor(null)} t={t} /> : null}
        </div>
    );
}

/** `background(image=bg_room, fadetime=1)`: a stage command, its long values cut. */
function commandText(cmd: StoryCommand): string {
    const args = Object.entries(cmd.args)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${k}=${(v ?? "").length > 40 ? `${(v ?? "").slice(0, 40)}…` : v}`);
    return args.length > 0 ? `${cmd.kind}(${args.join(", ")})` : cmd.kind;
}

/** The stage commands strictly between two script lines. */
function commandsBetween(commands: readonly StoryCommand[], after: number, before: number): StoryCommand[] {
    return commands.filter((c) => c.line > after && c.line < before && !DISPLAYED_KINDS.has(c.kind));
}

function ServiceRow({ commands, columns, t }: { commands: readonly StoryCommand[]; columns: number; t: T }): React.ReactElement | null {
    if (commands.length === 0) return null;
    return (
        <TableRow className="bg-muted/50 hover:bg-muted/50" aria-label={t("service.label")}>
            <TableCell colSpan={columns} className="whitespace-normal py-1 font-mono text-subtle-foreground text-xs leading-snug">
                {commands.map((c) => `${c.line} ${commandText(c)}`).join(" · ")}
            </TableCell>
        </TableRow>
    );
}

export interface ILinesTableProps {
    storyId: string;
    lines: readonly TranslatorLine[];
    /** What was proposed, approved and said, by entry. */
    edits: readonly KeyEdits[];
    /** Decisions left at this story's changed places. */
    outdated: readonly OutdatedEdit[];
    me: TranslatorsMe;
    label: string;
    showCn: boolean;
    showVariants: boolean;
    /** The script's commands when Service is on, else null. */
    commands: readonly StoryCommand[] | null;
    nickname: string;
}

export function LinesTable({ storyId, lines, edits, outdated, me, label, showCn, showVariants, commands, nickname }: ILinesTableProps): React.ReactElement {
    const t: T = useT("translators");
    const columns = showCn ? 5 : 4;
    const byKey = useMemo(() => new Map(edits.map((e) => [e.editKey, e])), [edits]);
    const staleAt = useMemo(() => {
        const out = new Map<string, OutdatedEdit[]>();
        for (const o of outdated) {
            const id = `${o.line}.${o.part}`;
            out.set(id, [...(out.get(id) ?? []), o]);
        }
        return out;
    }, [outdated]);
    // One editor open at a time: the row's id and what it is open for.
    const [editing, setEditing] = useState<{ id: string; state: EditorState } | null>(null);
    return (
        <Table aria-label={label}>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-14">{t("table.line")}</TableHead>
                    <TableHead className="w-36">{t("table.speaker")}</TableHead>
                    <TableHead>{t("table.ru")}</TableHead>
                    <TableHead>{t("table.en")}</TableHead>
                    {showCn ? <TableHead>{t("table.cn")}</TableHead> : null}
                </TableRow>
            </TableHeader>
            <TableBody>
                {lines.map((line, i) => {
                    const id = `${line.line}.${line.part}`;
                    const previous = i > 0 ? lines[i - 1].line : 0;
                    return (
                        <Fragment key={id}>
                            {commands ? <ServiceRow commands={commandsBetween(commands, previous, line.line)} columns={columns} t={t} /> : null}
                            <TableRow id={`n-${i + 1}`} className={cn("group/row scroll-mt-(--site-header-height) target:bg-primary/10", line.kind === "option" && "bg-primary/5")} data-line={line.line} data-kind={line.kind} data-status={line.status}>
                                <TableCell className="py-1.5 align-top text-subtle-foreground text-xs tabular-nums leading-snug">
                                    <span className="flex items-center gap-1.5">
                                        {i + 1}
                                        <StatusDot status={line.status} t={t} />
                                    </span>
                                    <LineActions line={line} n={i + 1} edits={byKey.get(line.editKey)} me={me} place={placeOf(storyId, line)} onOpen={(state) => setEditing({ id, state })} t={t} />
                                    {commands ? <span className="block font-mono">{t("table.scriptLine", { line: line.line })}</span> : null}
                                </TableCell>
                                <TableCell className={PROSE}>
                                    <Speaker line={line} t={t} />
                                </TableCell>
                                <TableCell className={PROSE}>
                                    <RuCell line={line} storyId={storyId} nickname={nickname} showVariants={showVariants} edits={byKey.get(line.editKey)} outdated={staleAt.get(id) ?? []} me={me} editor={editing?.id === id ? editing.state : null} onEditor={(state) => setEditing(state ? { id, state } : null)} t={t} />
                                </TableCell>
                                <TableCell className={PROSE}>
                                    <StoryText text={line.en} nickname={nickname} />
                                </TableCell>
                                {showCn ? (
                                    <TableCell className={PROSE}>
                                        {line.speakerCn ? <span className="block text-muted-foreground text-xs">{line.speakerCn}</span> : null}
                                        {line.cn ? <span className="whitespace-pre-line">{line.cn.replaceAll("\\n", "\n")}</span> : null}
                                    </TableCell>
                                ) : null}
                            </TableRow>
                        </Fragment>
                    );
                })}
                {commands && lines.length > 0 ? <ServiceRow commands={commandsBetween(commands, lines[lines.length - 1].line, Number.POSITIVE_INFINITY)} columns={columns} t={t} /> : null}
            </TableBody>
        </Table>
    );
}
