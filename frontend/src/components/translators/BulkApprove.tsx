/**
 * The lead's approvals for a whole scene: "Approve the recommended in the
 * whole scene" (a list with a checkbox per line, all ticked; untick to leave
 * a line out) and "Whole scene as in the game, checked" (the lines not yet
 * approved; those with proposals or with a mark on the game's text are left
 * out unless included).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { Spinner } from "#/components/ui/spinner";
import { toastManager } from "#/components/ui/toast";
import type { TypedT } from "#/lib/i18n/messages";
import { type AgreeVariant, approveBatchFn, EDIT_QUERY_ROOTS, type IApprovalInput } from "#/lib/translators/api";
import type { EditPlace } from "#/types/generated/EditPlace";
import { StoryText } from "./StoryText";
import type { messages } from "./translators.messages";

type T = TypedT<typeof messages>;

/** One line a batch can approve. */
export interface IBulkLine {
    /** The line's № in the table. */
    n: number;
    place: EditPlace;
    /** The recommended variant (`proposal:<id>`, `sova`, `ai`), if any. */
    recommended: string | null;
    /** The recommended variant's text. */
    recommendedText: string | null;
    approved: boolean;
    hasGame: boolean;
    hasProposals: boolean;
}

function toInput(place: EditPlace, variant: string): IApprovalInput {
    const [kind, id] = variant.split(":");
    return { place, variant: kind as AgreeVariant, proposalId: id ? Number(id) : null, approve: true };
}

function useBatch(t: T, onDone: () => void) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (items: IApprovalInput[]) => approveBatchFn({ data: { items } }),
        onSuccess: async (r) => {
            toastManager.add({ title: t("bulk.done", { approved: r.approved, skipped: r.skipped }), type: "success" });
            await Promise.all(EDIT_QUERY_ROOTS.map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] })));
            onDone();
        },
        onError: () => toastManager.add({ title: t("bulk.failed"), type: "error" }),
    });
}

function RecommendedDialog({ lines, nickname, onClose, t }: { lines: readonly IBulkLine[]; nickname: string; onClose: () => void; t: T }): React.ReactElement {
    const [left, setLeft] = useState<Set<number>>(new Set());
    const batch = useBatch(t, onClose);
    const chosen = lines.filter((l) => !left.has(l.n));
    return (
        <AlertDialog open onOpenChange={(open) => !open && onClose()}>
            <AlertDialogPopup className="max-w-2xl">
                <AlertDialogHeader>
                    <AlertDialogTitle>{t("bulk.recommendedTitle", { count: chosen.length })}</AlertDialogTitle>
                    <AlertDialogDescription>{t("bulk.recommendedHint")}</AlertDialogDescription>
                    <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto pt-2 text-sm">
                        {lines.map((l) => (
                            <li key={l.n}>
                                {/* biome-ignore lint/a11y/noLabelWithoutControl: the kit Checkbox inside is the control */}
                                <label className="flex items-start gap-2">
                                    <Checkbox
                                        checked={!left.has(l.n)}
                                        onCheckedChange={(v) =>
                                            setLeft((prev) => {
                                                const next = new Set(prev);
                                                if (v === true) next.delete(l.n);
                                                else next.add(l.n);
                                                return next;
                                            })
                                        }
                                    />
                                    <span className="w-8 shrink-0 text-subtle-foreground text-xs tabular-nums">{l.n}</span>
                                    <StoryText text={l.recommendedText ?? ""} nickname={nickname} />
                                </label>
                            </li>
                        ))}
                    </ul>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogClose render={<Button variant="ghost" />}>{t("editor.cancel")}</AlertDialogClose>
                    <Button onClick={() => batch.mutate(chosen.map((l) => toInput(l.place, l.recommended ?? "")))} disabled={batch.isPending || chosen.length === 0}>
                        {batch.isPending ? <Spinner /> : null}
                        {t("bulk.confirm")}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogPopup>
        </AlertDialog>
    );
}

function GameDialog({ lines, onClose, t }: { lines: readonly IBulkLine[]; onClose: () => void; t: T }): React.ReactElement {
    const [include, setInclude] = useState(false);
    const batch = useBatch(t, onClose);
    const open = lines.filter((l) => l.hasGame && !l.approved);
    const withProposals = open.filter((l) => l.hasProposals);
    const withMarks = open.filter((l) => !l.hasProposals && l.recommended !== null);
    const chosen = include ? open : open.filter((l) => !l.hasProposals && l.recommended === null);
    return (
        <AlertDialog open onOpenChange={(o) => !o && onClose()}>
            <AlertDialogPopup>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t("bulk.gameTitle", { count: chosen.length })}</AlertDialogTitle>
                    <AlertDialogDescription>{t("bulk.gameHint")}</AlertDialogDescription>
                    {withProposals.length + withMarks.length > 0 ? (
                        <div className="flex flex-col gap-1.5 pt-2 text-sm">
                            <span className="text-muted-foreground">{t("bulk.gameSkipped", { proposals: withProposals.length, marks: withMarks.length })}</span>
                            {/* biome-ignore lint/a11y/noLabelWithoutControl: the kit Checkbox inside is the control */}
                            <label className="flex items-center gap-2">
                                <Checkbox checked={include} onCheckedChange={(v) => setInclude(v === true)} />
                                {t("bulk.gameInclude")}
                            </label>
                        </div>
                    ) : null}
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogClose render={<Button variant="ghost" />}>{t("editor.cancel")}</AlertDialogClose>
                    <Button onClick={() => batch.mutate(chosen.map((l) => toInput(l.place, "game")))} disabled={batch.isPending || chosen.length === 0}>
                        {batch.isPending ? <Spinner /> : null}
                        {t("bulk.confirm")}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogPopup>
        </AlertDialog>
    );
}

/** The two batch buttons above the table and their dialogs (the lead only; the caller checks). */
export function BulkApprove({ lines, nickname, t }: { lines: readonly IBulkLine[]; nickname: string; t: T }): React.ReactElement {
    const [open, setOpen] = useState<"recommended" | "game" | null>(null);
    const recommended = lines.filter((l) => l.recommended !== null && !l.approved);
    return (
        <>
            <Button variant="outline" size="sm" onClick={() => setOpen("recommended")} disabled={recommended.length === 0}>
                <CheckCheck aria-hidden="true" />
                {t("bulk.recommended")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setOpen("game")}>
                <CheckCheck aria-hidden="true" />
                {t("bulk.game")}
            </Button>
            {open === "recommended" ? <RecommendedDialog lines={recommended} nickname={nickname} onClose={() => setOpen(null)} t={t} /> : null}
            {open === "game" ? <GameDialog lines={lines} onClose={() => setOpen(null)} t={t} /> : null}
        </>
    );
}
