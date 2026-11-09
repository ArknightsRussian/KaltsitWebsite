/**
 * A variant's automatic marks, inline after its text or label so a row never
 * grows: "recommended", and only what is wrong (a glossary form missing,
 * tags, substitutions, line breaks, noticeably longer, ты / вы against the
 * speaker's neighbouring lines).
 */
import { AlertTriangle, Star, X } from "lucide-react";
import type React from "react";
import { Badge } from "#/components/ui/badge";
import { useFormatters } from "#/lib/i18n";
import type { TypedT } from "#/lib/i18n/messages";
import type { IVariantCheck } from "./checks";
import type { messages } from "./translators.messages";

type T = TypedT<typeof messages>;

function Warn({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
    return (
        <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-warning-foreground" title={title}>
            <AlertTriangle className="size-3" aria-hidden="true" />
            {children}
            <span className="sr-only">{title}</span>
        </span>
    );
}

export interface IMarksProps {
    check: IVariantCheck;
    recommended: boolean;
    /** The game's Russian shows its glossary terms on their own line already. */
    skipGlossary?: boolean;
    t: T;
}

export function Marks({ check, recommended, skipGlossary = false, t }: IMarksProps): React.ReactElement | null {
    const f = useFormatters();
    const glossary = skipGlossary ? [] : check.glossary;
    const any = recommended || glossary.length > 0 || check.tags || check.placeholders.length > 0 || check.newlines || check.longer !== null || check.address;
    if (!any) return null;
    return (
        <span className="ms-1.5 inline-flex flex-wrap items-center gap-x-1.5 align-baseline text-xs">
            {recommended ? (
                <Badge variant="success" size="sm" title={t("checks.recommendedHint")}>
                    <Star aria-hidden="true" />
                    {t("checks.recommended")}
                </Badge>
            ) : null}
            {glossary.length > 0 ? (
                <span className="inline-flex items-center gap-0.5 text-warning-foreground" title={t("checks.glossaryHint", { terms: glossary.map((g) => `${g.en} → ${g.ru}`).join(", ") })}>
                    <X className="size-3" aria-hidden="true" />
                    {glossary.map((g) => g.ru).join(", ")}
                </span>
            ) : null}
            {check.tags ? <Warn title={t("checks.tagsHint")}>{t("checks.tags")}</Warn> : null}
            {check.placeholders.length > 0 ? <Warn title={t("checks.placeholdersHint")}>{check.placeholders.join(" ")}</Warn> : null}
            {check.newlines ? <Warn title={t("checks.newlinesHint", { en: check.newlines.en, ru: check.newlines.ru })}>{t("checks.newlines", { en: check.newlines.en, ru: check.newlines.ru })}</Warn> : null}
            {check.longer !== null ? <Warn title={t("checks.longerHint")}>{t("checks.longer", { share: f.percent(check.longer) })}</Warn> : null}
            {check.address ? <Warn title={t("checks.addressHint", { form: check.address })}>{t("checks.address", { form: check.address === "ты" ? "вы" : "ты" })}</Warn> : null}
        </span>
    );
}
