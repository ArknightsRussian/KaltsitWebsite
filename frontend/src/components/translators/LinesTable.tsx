/**
 * One story's lines as a dense table: # | speaker | Russian as in the game |
 * English | Chinese (optional). Under the Russian: the glossary terms of the
 * line's English with whether the Russian holds their form, the proposals,
 * Sova's and the AI's variants (each with "Propose this"), the notes and
 * remarks. Hovering the Russian shows its actions (LineEdits.tsx); a double
 * click on it proposes. With Service on, the stage commands sit between the
 * lines as gray rows, in words.
 */
import { Check, X } from "lucide-react";
import type React from "react";
import { Fragment, useMemo, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { InfoHint } from "#/components/ui/info-hint";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { useT } from "#/lib/i18n";
import type { TypedT } from "#/lib/i18n/messages";
import { cn } from "#/lib/utils";
import type { KeyEdits } from "#/types/generated/KeyEdits";
import type { LineTerm } from "#/types/generated/LineTerm";
import type { OutdatedEdit } from "#/types/generated/OutdatedEdit";
import type { StoryCommand } from "#/types/generated/StoryCommand";
import type { TranslatorLine } from "#/types/generated/TranslatorLine";
import type { TranslatorsMe } from "#/types/generated/TranslatorsMe";
import { ApprovedVariant, CellActions, CommentEditor, type EditorState, LineComments, OutdatedHere, ProposalEditor, Proposals, placeOf, quotesAt, StatusDot, TONE, Toned, VariantNotes } from "./LineEdits";
import { StoryText } from "./StoryText";
import { DISPLAYED_KINDS, describeCommands } from "./service";
import type { messages } from "./translators.messages";

type T = TypedT<typeof messages>;

/** A prose cell wraps, reads from the top and stays dense (the kit cell is one nowrap line). */
const PROSE = "whitespace-normal py-1.5 align-top leading-snug";

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
function groupTerms(terms: readonly LineTerm[], sovaSheet: string): ITermGroup[] {
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
        const about = [term.fromSova ? sovaSheet : term.sheet, term.ruPlural, term.note].filter(Boolean).join(" · ");
        g.title = g.title ? `${g.title}\n${about}` : about;
    }
    return [...out.values()];
}

function Terms({ terms, t }: { terms: readonly LineTerm[]; t: T }): React.ReactElement | null {
    if (terms.length === 0) return null;
    return (
        <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" aria-label={t("terms.label")}>
            {groupTerms(terms, t("glossary.sovaSheet")).map((g) => (
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
    const quotes = quotesAt(edits, place);
    const notes = { edits, place, me, t };
    const take = (source: "sova" | "ai", text: string) => (
        <Button variant="ghost" size="xs" onClick={() => onEditor({ kind: "proposal", text, source, context: false })}>
            {t("action.proposeThis")}
        </Button>
    );
    return (
        <div className="group/cell relative flex flex-col gap-1">
            {editor === null ? <CellActions line={line} onOpen={onEditor} t={t} /> : null}
            <ApprovedVariant edits={edits} nickname={nickname} t={t} />
            {/* biome-ignore lint/a11y/noStaticElementInteractions: a shortcut; the Propose button is the accessible way */}
            <div
                onDoubleClick={() => {
                    if (!line.editable || editor) return;
                    window.getSelection()?.removeAllRanges();
                    onEditor({ kind: "proposal", text: line.ruGame ?? "", source: "own", context: false });
                }}
            >
                {line.ruGame ? <StoryText text={line.ruGame} nickname={nickname} quotes={quotes} /> : <span className="text-subtle-foreground">{t("ru.missing")}</span>}
            </div>
            <VariantNotes {...notes} variant="game" />
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
            <Proposals {...notes} nickname={nickname} onEdit={(p) => onEditor({ kind: "proposal", text: p.text, source: p.source === "sova" || p.source === "ai" ? p.source : "own", context: p.context })} />
            {showVariants ? (
                <>
                    {line.sova ? (
                        <>
                            <Toned tone={TONE.sova} label={t("hints.sova")} actions={line.editable && !editor ? take("sova", line.sova) : undefined}>
                                <StoryText text={line.sova} nickname={nickname} />
                            </Toned>
                            <VariantNotes {...notes} variant="sova" />
                        </>
                    ) : null}
                    {line.ai ? (
                        <>
                            <Toned tone={TONE.ai} label={t("hints.ai")} actions={line.editable && !editor ? take("ai", line.ai) : undefined}>
                                <StoryText text={line.ai} nickname={nickname} />
                            </Toned>
                            <VariantNotes {...notes} variant="ai" />
                        </>
                    ) : null}
                    {line.ruDict ? (
                        <Toned tone={TONE.dict} label={t("hints.dict")}>
                            <StoryText text={line.ruDict} nickname={nickname} />
                        </Toned>
                    ) : null}
                </>
            ) : null}
            <OutdatedHere items={outdated} nickname={nickname} t={t} />
            <LineComments {...notes} />
            {editor?.kind === "proposal" ? <ProposalEditor line={line} place={place} initial={editor.text} source={editor.source} context={editor.context} nickname={nickname} onClose={() => onEditor(null)} t={t} /> : null}
            {editor && editor.kind !== "proposal" ? <CommentEditor line={line} place={place} edits={edits} kind={editor.kind} quote={editor.quote} onClose={() => onEditor(null)} t={t} /> : null}
        </div>
    );
}

/** The stage commands strictly between two script lines. */
function commandsBetween(commands: readonly StoryCommand[], after: number, before: number): StoryCommand[] {
    return commands.filter((c) => c.line > after && c.line < before && !DISPLAYED_KINDS.has(c.kind));
}

function ServiceRow({ commands, columns, nameOf, t }: { commands: readonly StoryCommand[]; columns: number; nameOf: (id: string) => string; t: T }): React.ReactElement | null {
    const words = describeCommands(commands, t, nameOf);
    if (!words) return null;
    return (
        <TableRow className="bg-muted/50 hover:bg-muted/50" aria-label={t("service.label")}>
            <TableCell colSpan={columns} className="whitespace-normal py-1 text-subtle-foreground text-xs leading-snug">
                {words}
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
    /** A sprite's name for "On stage". */
    nameOf: (charId: string) => string;
    /** Shown for `{@nickname}`. */
    nickname: string;
}

export function LinesTable({ storyId, lines, edits, outdated, me, label, showCn, showVariants, commands, nameOf, nickname }: ILinesTableProps): React.ReactElement {
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
                    <TableHead className="w-12">{t("table.line")}</TableHead>
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
                    const lineEdits = byKey.get(line.editKey);
                    return (
                        <Fragment key={id}>
                            {commands ? <ServiceRow commands={commandsBetween(commands, previous, line.line)} columns={columns} nameOf={nameOf} t={t} /> : null}
                            <TableRow id={`n-${i + 1}`} className={cn("scroll-mt-(--site-header-height) target:bg-primary/10", line.kind === "option" && "bg-primary/5")} data-line={line.line} data-kind={line.kind} data-status={line.status}>
                                <TableCell className="py-1.5 align-top text-subtle-foreground text-xs tabular-nums leading-snug">
                                    <span className="flex items-center gap-1.5">
                                        {i + 1}
                                        <StatusDot status={line.status} t={t} />
                                    </span>
                                    {commands ? <span className="block font-mono">{t("table.scriptLine", { line: line.line })}</span> : null}
                                </TableCell>
                                <TableCell className={PROSE}>
                                    <Speaker line={line} t={t} />
                                </TableCell>
                                <TableCell className={PROSE}>
                                    <RuCell line={line} storyId={storyId} nickname={nickname} showVariants={showVariants} edits={lineEdits} outdated={staleAt.get(id) ?? []} me={me} editor={editing?.id === id ? editing.state : null} onEditor={(state) => setEditing(state ? { id, state } : null)} t={t} />
                                </TableCell>
                                <TableCell className={PROSE}>
                                    <StoryText text={line.en} nickname={nickname} quotes={quotesAt(lineEdits, placeOf(storyId, line))} />
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
                {commands && lines.length > 0 ? <ServiceRow commands={commandsBetween(commands, lines[lines.length - 1].line, Number.POSITIVE_INFINITY)} columns={columns} nameOf={nameOf} t={t} /> : null}
            </TableBody>
        </Table>
    );
}
