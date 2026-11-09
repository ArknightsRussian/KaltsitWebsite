/**
 * Editing one story line (translators/PLAN-edit.md): the approved variant,
 * the translators' proposals and comments under the Russian, the row's
 * actions (write my own, take Sova's or the AI's, keep as in the game,
 * comment) and the in-row editor. Every decision is for the line's
 * dictionary entry (`editKey`), so it holds in all the entry's places: more
 * than 20 places ask for a confirmation with the list first.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, MessageSquare, PenLine, Sparkles, Trash2, Undo2 } from "lucide-react";
import type React from "react";
import { useId, useRef, useState } from "react";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "#/components/ui/alert-dialog";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "#/components/ui/collapsible";
import { LoadFailed } from "#/components/ui/load-failed";
import { Menu, MenuCheckboxItem, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "#/components/ui/menu";
import { Skeleton } from "#/components/ui/skeleton";
import { Spinner } from "#/components/ui/spinner";
import { Textarea } from "#/components/ui/textarea";
import { toastManager } from "#/components/ui/toast";
import { useFormatters } from "#/lib/i18n";
import type { TypedT } from "#/lib/i18n/messages";
import { createCommentFn, createProposalFn, deleteCommentFn, deleteProposalFn, EDIT_QUERY_ROOTS, type ProposalSource, placesQueryOptions, resolveCommentFn, setAgreementFn } from "#/lib/translators/api";
import type { EditComment } from "#/types/generated/EditComment";
import type { EditPerson } from "#/types/generated/EditPerson";
import type { EditPlace } from "#/types/generated/EditPlace";
import type { KeyEdits } from "#/types/generated/KeyEdits";
import type { OutdatedEdit } from "#/types/generated/OutdatedEdit";
import type { Proposal } from "#/types/generated/Proposal";
import type { TranslatorLine } from "#/types/generated/TranslatorLine";
import type { TranslatorsMe } from "#/types/generated/TranslatorsMe";
import { useStoryNames } from "./storyNames";
import type { messages } from "./translators.messages";

type T = TypedT<typeof messages>;

/** More places than this: the edit is confirmed with the list (the backend asks the same). */
export const CONFIRM_PLACES = 20;

/** The tones of the edit variants, from the project's tokens (see LinesTable's VARIANT_TONE). */
export const EDIT_TONE = {
    approved: "var(--success)",
    proposal: "var(--primary)",
    outdated: "var(--warning)",
    comment: "var(--muted-foreground)",
} as const;

/** The status dot's tone; `unchecked` shows none. */
const STATUS_TONE: Record<string, string | undefined> = {
    proposed: "var(--info)",
    approved: "var(--success)",
    outdated: "var(--warning)",
};

export function placeOf(storyId: string, line: TranslatorLine): EditPlace {
    return { storyId, line: line.line, part: line.part };
}

/** Line breaks as LF, trimmed: the way the backend stores a text. */
export function cleanText(s: string): string {
    return s.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
}

export function isLead(me: TranslatorsMe): boolean {
    return me.role === "editor" || me.role === "admin";
}

/** Run an edit, then refresh every story's lines and My edits; a failure is a toast in the section's words. */
export function useEditMutation<V>(fn: (v: V) => Promise<unknown>, failed: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: fn,
        onSuccess: () => Promise.all(EDIT_QUERY_ROOTS.map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] }))),
        onError: () => toastManager.add({ title: failed, type: "error" }),
    });
}

export function StatusDot({ status, t }: { status: string; t: T }): React.ReactElement | null {
    const tone = STATUS_TONE[status];
    if (!tone) return null;
    return (
        <span className="inline-flex items-center" title={t(`status.${status}` as "status.proposed")}>
            <span className="size-2 rounded-full bg-(--tone)" style={{ "--tone": tone } as React.CSSProperties} aria-hidden="true" />
            <span className="sr-only">{t(`status.${status}` as "status.proposed")}</span>
        </span>
    );
}

function names(people: readonly EditPerson[]): string {
    return people.map((p) => p.name).join(", ");
}

function Toned({ tone, label, children, actions }: { tone: string; label: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode }): React.ReactElement {
    return (
        <div className="flex flex-col gap-0.5 border-(--tone) border-s-2 ps-2" style={{ "--tone": tone } as React.CSSProperties}>
            <span className="flex flex-wrap items-center gap-x-1.5 text-subtle-foreground text-xs">{label}</span>
            <div className="whitespace-pre-line">{children}</div>
            {actions ? <div className="flex flex-wrap gap-1">{actions}</div> : null}
        </div>
    );
}

/** The approved variant: above everything else in the cell. */
export function ApprovedVariant({ edits, t }: { edits: KeyEdits | undefined; t: T }): React.ReactElement | null {
    const f = useFormatters();
    const a = edits?.approval;
    if (!a) return null;
    const when = f.date(a.at * 1000, { dateStyle: "medium" });
    return (
        <Toned tone={EDIT_TONE.approved} label={a.proposalId === null ? t("approved.game", { name: a.by.name, date: when }) : t("approved.label", { name: a.by.name, date: when })}>
            {a.text}
        </Toned>
    );
}

/** Who keeps the game's Russian, under it. */
export function GameKeepers({ edits, t }: { edits: KeyEdits | undefined; t: T }): React.ReactElement | null {
    const people = edits?.gameAgreements ?? [];
    if (people.length === 0) return null;
    return <span className="text-subtle-foreground text-xs">{t("keep.by", { count: people.length, names: names(people) })}</span>;
}

interface IProposalsProps {
    edits: KeyEdits | undefined;
    me: TranslatorsMe;
    onEdit: (p: Proposal) => void;
    t: T;
}

export function Proposals({ edits, me, onEdit, t }: IProposalsProps): React.ReactElement | null {
    const f = useFormatters();
    const remove = useEditMutation((id: number) => deleteProposalFn({ data: { id } }), t("edit.failedDelete"));
    const list = edits?.proposals ?? [];
    if (list.length === 0) return null;
    return (
        <>
            {list.map((p) => {
                const mine = p.author.id === me.userId;
                const label = (
                    <>
                        <span>{mine ? t("proposal.mine") : p.author.name}</span>
                        <span>· {f.date((p.editedAt ?? p.createdAt) * 1000, { dateStyle: "medium" })}</span>
                        {p.editedAt !== null ? <span>· {t("proposal.edited")}</span> : null}
                        {p.source !== "own" ? <span>· {t(`proposal.from.${p.source}` as "proposal.from.sova")}</span> : null}
                        {p.agreements.length > 0 ? <span title={names(p.agreements)}>· {t("proposal.agreed", { count: p.agreements.length })}</span> : null}
                    </>
                );
                return (
                    <Toned
                        key={p.id}
                        tone={EDIT_TONE.proposal}
                        label={label}
                        actions={
                            mine ? (
                                <>
                                    <Button variant="ghost" size="sm" onClick={() => onEdit(p)}>
                                        <PenLine aria-hidden="true" />
                                        {t("proposal.edit")}
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => remove.mutate(p.id)} disabled={remove.isPending}>
                                        <Trash2 aria-hidden="true" />
                                        {t("proposal.delete")}
                                    </Button>
                                </>
                            ) : undefined
                        }
                    >
                        {p.text}
                    </Toned>
                );
            })}
        </>
    );
}

/** Decisions left at this place for an English that has changed since. */
export function OutdatedHere({ items, t }: { items: readonly OutdatedEdit[]; t: T }): React.ReactElement | null {
    if (items.length === 0) return null;
    return (
        <>
            {items.map((o) => (
                <Toned
                    key={`${o.kind}-${o.editKey}-${o.author.id}`}
                    tone={EDIT_TONE.outdated}
                    label={
                        <>
                            <Badge variant="warning" size="sm">
                                {t("status.outdated")}
                            </Badge>
                            <span>{t(o.kind === "approval" ? "outdated.approval" : "outdated.proposal", { name: o.author.name })}</span>
                        </>
                    }
                >
                    <span>{o.text}</span>
                    <span className="block text-subtle-foreground text-xs">{t("outdated.was", { en: o.editKey })}</span>
                </Toned>
            ))}
        </>
    );
}

function CommentItem({ c, me, t }: { c: EditComment; me: TranslatorsMe; t: T }): React.ReactElement {
    const f = useFormatters();
    const mine = c.author.id === me.userId;
    const resolve = useEditMutation((resolved: boolean) => resolveCommentFn({ data: { id: c.id, resolved } }), t("comment.failed"));
    const remove = useEditMutation(() => deleteCommentFn({ data: { id: c.id } }), t("comment.failed"));
    const canResolve = mine || isLead(me);
    return (
        <Toned
            tone={EDIT_TONE.comment}
            label={
                <>
                    <MessageSquare className="size-3" aria-hidden="true" />
                    <span>{c.author.name}</span>
                    <span>· {f.date(c.createdAt * 1000, { dateStyle: "medium" })}</span>
                    {c.resolvedBy ? <span>· {t("comment.resolvedBy", { name: c.resolvedBy.name })}</span> : null}
                </>
            }
            actions={
                canResolve || mine ? (
                    <>
                        {canResolve ? (
                            <Button variant="ghost" size="sm" onClick={() => resolve.mutate(!c.resolvedBy)} disabled={resolve.isPending}>
                                {c.resolvedBy ? <Undo2 aria-hidden="true" /> : <Check aria-hidden="true" />}
                                {c.resolvedBy ? t("comment.reopen") : t("comment.resolve")}
                            </Button>
                        ) : null}
                        {mine ? (
                            <Button variant="ghost" size="sm" onClick={() => remove.mutate(undefined)} disabled={remove.isPending}>
                                <Trash2 aria-hidden="true" />
                                {t("comment.delete")}
                            </Button>
                        ) : null}
                    </>
                ) : undefined
            }
        >
            <span className="text-muted-foreground">{c.text}</span>
        </Toned>
    );
}

/** Open comments, then the resolved ones folded under one line. */
export function Comments({ edits, me, t }: { edits: KeyEdits | undefined; me: TranslatorsMe; t: T }): React.ReactElement | null {
    const list = edits?.comments ?? [];
    if (list.length === 0) return null;
    const open = list.filter((c) => !c.resolvedBy);
    const resolved = list.filter((c) => c.resolvedBy);
    return (
        <>
            {open.map((c) => (
                <CommentItem key={c.id} c={c} me={me} t={t} />
            ))}
            {resolved.length > 0 ? (
                <Collapsible>
                    <CollapsibleTrigger render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}>{t("comment.resolvedCount", { count: resolved.length })}</CollapsibleTrigger>
                    <CollapsiblePanel className="flex flex-col gap-1 pt-1">
                        {resolved.map((c) => (
                            <CommentItem key={c.id} c={c} me={me} t={t} />
                        ))}
                    </CollapsiblePanel>
                </Collapsible>
            ) : null}
        </>
    );
}

/** What the in-row editor is open for. */
export type EditorState = { kind: "proposal"; text: string; source: ProposalSource } | { kind: "comment" };

interface IActionsProps {
    line: TranslatorLine;
    /** The line's № in the table. */
    n: number;
    edits: KeyEdits | undefined;
    me: TranslatorsMe;
    place: EditPlace;
    onOpen: (state: EditorState) => void;
    t: T;
}

/**
 * The row's actions in one small menu by the line number (write my own,
 * take Sova's / the AI's, keep as in the game, comment): a bar of buttons
 * under every line made the dense table twice as tall.
 */
export function LineActions({ line, n, edits, me, place, onOpen, t }: IActionsProps): React.ReactElement {
    const mineProposal = edits?.proposals.find((p) => p.author.id === me.userId);
    const keeping = Boolean(edits?.gameAgreements.some((p) => p.id === me.userId));
    const keep = useEditMutation((agree: boolean) => setAgreementFn({ data: { place, proposalId: null, agree } }), t("edit.failedKeep"));
    // An item that opens the editor keeps the focus there instead of returning it to the menu button.
    const toEditor = useRef(false);
    const open = (state: EditorState) => {
        toEditor.current = true;
        onOpen(state);
    };
    return (
        <Menu>
            <MenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={t("action.menu", { n })} title={t("action.menuTitle")} />}>
                <PenLine aria-hidden="true" />
            </MenuTrigger>
            <MenuPopup
                align="start"
                finalFocus={() => {
                    const keepFocus = !toEditor.current;
                    toEditor.current = false;
                    return keepFocus;
                }}
            >
                {line.editable ? (
                    <>
                        <MenuItem onClick={() => open({ kind: "proposal", text: mineProposal?.text ?? line.ruGame ?? "", source: (mineProposal?.source as ProposalSource | undefined) ?? "own" })}>
                            <PenLine aria-hidden="true" />
                            {mineProposal ? t("action.editMine") : t("action.write")}
                        </MenuItem>
                        {line.sova ? (
                            <MenuItem onClick={() => open({ kind: "proposal", text: line.sova ?? "", source: "sova" })}>
                                <Sparkles aria-hidden="true" />
                                {t("action.takeSova")}
                            </MenuItem>
                        ) : null}
                        {line.ai ? (
                            <MenuItem onClick={() => open({ kind: "proposal", text: line.ai ?? "", source: "ai" })}>
                                <Sparkles aria-hidden="true" />
                                {t("action.takeAi")}
                            </MenuItem>
                        ) : null}
                        {line.ruGame ? (
                            <MenuCheckboxItem closeOnClick checked={keeping} onCheckedChange={(checked: boolean) => keep.mutate(checked)} disabled={keep.isPending}>
                                {t("action.keep")}
                            </MenuCheckboxItem>
                        ) : null}
                    </>
                ) : (
                    <MenuItem disabled>{t("edit.notEditable")}</MenuItem>
                )}
                <MenuSeparator />
                <MenuItem onClick={() => open({ kind: "comment" })}>
                    <MessageSquare aria-hidden="true" />
                    {t("action.comment")}
                </MenuItem>
            </MenuPopup>
        </Menu>
    );
}

/** Every place of the entry, as links to the lines. */
export function PlacesList({ place, t }: { place: EditPlace; t: T }): React.ReactElement {
    const query = useQuery(placesQueryOptions(place));
    const nameOf = useStoryNames();
    if (query.isError) return <LoadFailed layout="inline" message={t("places.load")} onRetry={() => query.refetch()} />;
    if (!query.data) return <Skeleton className="h-16 w-full" />;
    const { places, total } = query.data;
    return (
        <div className="flex flex-col gap-1">
            <ul className="flex max-h-60 flex-col gap-0.5 overflow-y-auto text-xs">
                {places.map((p) => {
                    const n = nameOf(p.storyId);
                    const here = p.storyId === place.storyId && p.line === place.line && p.part === place.part;
                    return (
                        <li key={`${p.storyId}-${p.line}-${p.part}`}>
                            {n ? (
                                <Link to="/translators" search={{ group: n.groupId, story: p.storyId }} hash={`n-${p.ord + 1}`} className="underline-offset-4 hover:underline">
                                    {t("places.item", { group: n.group, story: n.story, n: p.ord + 1 })}
                                </Link>
                            ) : (
                                <span>{t("places.itemBare", { story: p.storyId, n: p.ord + 1 })}</span>
                            )}
                            {here ? <span className="text-subtle-foreground"> · {t("places.here")}</span> : null}
                        </li>
                    );
                })}
            </ul>
            {total > places.length ? <span className="text-subtle-foreground text-xs">{t("places.more", { count: total - places.length })}</span> : null}
        </div>
    );
}

/** "Also in N other places" under the editor, with the list on demand. */
function PlacesNote({ line, place, t }: { line: TranslatorLine; place: EditPlace; t: T }): React.ReactElement | null {
    if (line.places < 2) return null;
    return (
        <Collapsible>
            <span className="flex flex-wrap items-center gap-1 text-warning-foreground text-xs">
                {t("places.note", { count: line.places - 1 })}
                <CollapsibleTrigger render={<Button variant="link" size="sm" className="h-auto px-0 text-xs" />}>{t("places.show")}</CollapsibleTrigger>
            </span>
            <CollapsiblePanel className="pt-1">
                <PlacesList place={place} t={t} />
            </CollapsiblePanel>
        </Collapsible>
    );
}

interface IEditorProps {
    line: TranslatorLine;
    place: EditPlace;
    initial: string;
    source: ProposalSource;
    onClose: () => void;
    t: T;
}

/** The in-row editor of my proposal: Ctrl+Enter saves, Esc cancels. */
export function ProposalEditor({ line, place, initial, source, onClose, t }: IEditorProps): React.ReactElement {
    const id = useId();
    const [text, setText] = useState(initial);
    const [confirming, setConfirming] = useState(false);
    const save = useEditMutation((confirmMany: boolean) => createProposalFn({ data: { place, text, source, confirmMany } }), t("edit.failedSave"));
    const clean = cleanText(text);
    const sameAsGame = line.ruGame !== null && clean === cleanText(line.ruGame);
    const canSave = clean.length > 0 && !sameAsGame && !save.isPending;
    const many = line.places > CONFIRM_PLACES;

    const submit = (confirmMany: boolean) => {
        if (!canSave) return;
        if (many && !confirmMany) {
            setConfirming(true);
            return;
        }
        save.mutate(confirmMany, {
            onSuccess: () => {
                setConfirming(false);
                onClose();
            },
        });
    };

    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-subtle-foreground text-xs">
                {source === "own" ? t("editor.label") : t(`editor.label.${source}` as "editor.label.sova")}
            </label>
            <Textarea
                id={id}
                size="sm"
                value={text}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        submit(false);
                    } else if (e.key === "Escape") {
                        e.preventDefault();
                        onClose();
                    }
                }}
                autoFocus
            />
            {line.ruGameMatch === "lines" || line.en.includes("\n") ? <span className="text-subtle-foreground text-xs">{t("editor.wholeEntry")}</span> : null}
            {sameAsGame ? <span className="text-subtle-foreground text-xs">{t("editor.sameAsGame")}</span> : null}
            <PlacesNote line={line} place={place} t={t} />
            <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => submit(false)} disabled={!canSave}>
                    {save.isPending ? <Spinner /> : null}
                    {t("editor.save")}
                </Button>
                <Button size="sm" variant="ghost" onClick={onClose}>
                    {t("editor.cancel")}
                </Button>
                <span className="text-subtle-foreground text-xs">{t("editor.keys")}</span>
            </div>

            <AlertDialog open={confirming} onOpenChange={setConfirming}>
                <AlertDialogPopup>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("confirm.title", { count: line.places })}</AlertDialogTitle>
                        <AlertDialogDescription>{t("confirm.description")}</AlertDialogDescription>
                        <PlacesList place={place} t={t} />
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogClose render={<Button variant="ghost" />}>{t("editor.cancel")}</AlertDialogClose>
                        <Button onClick={() => submit(true)} disabled={save.isPending}>
                            {save.isPending ? <Spinner /> : null}
                            {t("confirm.save", { count: line.places })}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogPopup>
            </AlertDialog>
        </div>
    );
}

/** The in-row comment box. */
export function CommentEditor({ place, onClose, t }: { place: EditPlace; onClose: () => void; t: T }): React.ReactElement {
    const id = useId();
    const [text, setText] = useState("");
    const save = useEditMutation(() => createCommentFn({ data: { place, text } }), t("comment.failed"));
    const submit = () => {
        if (cleanText(text).length === 0 || save.isPending) return;
        save.mutate(undefined, { onSuccess: onClose });
    };
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-subtle-foreground text-xs">
                {t("comment.label")}
            </label>
            <Textarea
                id={id}
                size="sm"
                value={text}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        submit();
                    } else if (e.key === "Escape") {
                        e.preventDefault();
                        onClose();
                    }
                }}
                autoFocus
            />
            <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={submit} disabled={cleanText(text).length === 0 || save.isPending}>
                    {save.isPending ? <Spinner /> : null}
                    {t("comment.save")}
                </Button>
                <Button size="sm" variant="ghost" onClick={onClose}>
                    {t("editor.cancel")}
                </Button>
                <span className="text-subtle-foreground text-xs">{t("editor.keys")}</span>
            </div>
        </div>
    );
}
