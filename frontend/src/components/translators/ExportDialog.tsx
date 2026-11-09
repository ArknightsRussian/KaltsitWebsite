/**
 * "Export…" in My edits: what (approved, for the game — the lead only; or
 * every proposal, for checking — REVIEW), the format (one 00_translators.txt
 * or patched copies of 11_ui / 12_story / 13_names), then the report and
 * each file to download (plugin.csv, context.csv and report.txt too). The
 * files come from the section's own `/translators/export` download route.
 */
import { useMutation } from "@tanstack/react-query";
import { Download, FileOutput } from "lucide-react";
import type React from "react";
import { useId, useState } from "react";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Dialog, DialogHeader, DialogPanel, DialogPopup, DialogTitle, DialogTrigger } from "#/components/ui/dialog";
import { LoadFailed } from "#/components/ui/load-failed";
import { Radio, RadioGroup } from "#/components/ui/radio-group";
import { Spinner } from "#/components/ui/spinner";
import { useFormatters } from "#/lib/i18n";
import type { TypedT } from "#/lib/i18n/messages";
import { type ExportFormat, type ExportMode, exportFn } from "#/lib/translators/api";
import type { messages } from "./translators.messages";

type T = TypedT<typeof messages>;

function Choice({ value, label, hint, disabled }: { value: string; label: string; hint?: string; disabled?: boolean }): React.ReactElement {
    return (
        // biome-ignore lint/a11y/noLabelWithoutControl: the kit Radio inside is the control
        <label className="flex items-start gap-2 text-sm">
            <Radio value={value} disabled={disabled} />
            <span className="flex flex-col">
                <span className="font-medium">{label}</span>
                {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
            </span>
        </label>
    );
}

export function ExportDialog({ lead, t }: { lead: boolean; t: T }): React.ReactElement {
    const f = useFormatters();
    const ids = { mode: useId(), format: useId() };
    const [mode, setMode] = useState<ExportMode>(lead ? "approved" : "review");
    const [format, setFormat] = useState<ExportFormat>("file");
    const run = useMutation({ mutationFn: () => exportFn({ data: { mode, format } }) });
    const r = run.data?.report;
    return (
        <Dialog>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
                <FileOutput aria-hidden="true" />
                {t("export.open")}
            </DialogTrigger>
            <DialogPopup className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>{t("export.title")}</DialogTitle>
                </DialogHeader>
                <DialogPanel className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <span id={ids.mode} className="font-medium text-sm">
                            {t("export.mode")}
                        </span>
                        <RadioGroup
                            aria-labelledby={ids.mode}
                            value={mode}
                            onValueChange={(v) => {
                                setMode(v as ExportMode);
                                run.reset();
                            }}
                            className="gap-2"
                        >
                            <Choice value="approved" label={t("export.mode.approved")} hint={lead ? undefined : t("export.mode.approvedHint")} disabled={!lead} />
                            <Choice value="review" label={t("export.mode.review")} />
                        </RadioGroup>
                    </div>
                    <div className="flex flex-col gap-2">
                        <span id={ids.format} className="font-medium text-sm">
                            {t("export.format")}
                        </span>
                        <RadioGroup
                            aria-labelledby={ids.format}
                            value={format}
                            onValueChange={(v) => {
                                setFormat(v as ExportFormat);
                                run.reset();
                            }}
                            className="gap-2"
                        >
                            <Choice value="file" label={t("export.format.file")} />
                            <Choice value="patch" label={t("export.format.patch")} />
                        </RadioGroup>
                    </div>
                    <div>
                        <Button size="sm" onClick={() => run.mutate()} disabled={run.isPending}>
                            {run.isPending ? <Spinner /> : null}
                            {t("export.run")}
                        </Button>
                    </div>
                    {run.isError ? <LoadFailed layout="inline" message={t("export.load")} onRetry={() => run.mutate()} /> : null}
                    {r && run.data ? (
                        <div className="flex flex-col gap-2 text-sm">
                            <ul className="flex flex-col gap-0.5">
                                <li>{t("export.written", { count: r.written })}</li>
                                <li>{t("export.plugin", { count: r.pluginRows })}</li>
                                <li>{t("export.context", { count: r.contextRows })}</li>
                                <li className={r.skipped.length > 0 ? "text-warning-foreground" : undefined}>{t("export.skipped", { count: r.skipped.length })}</li>
                                <li className={r.overriddenBy.length > 0 ? "text-warning-foreground" : "text-muted-foreground"}>{r.loadedAfter.length > 0 ? t("export.after", { files: r.loadedAfter.map((x) => `${x} (${r.overriddenBy.find((o) => o.file === x)?.keys ?? 0})`).join(", ") }) : t("export.afterNone")}</li>
                            </ul>
                            <Alert variant="info">
                                <AlertDescription>{t("export.howTo")}</AlertDescription>
                            </Alert>
                            <span className="font-medium">{t("export.files")}</span>
                            <ul className="flex flex-col gap-1">
                                {run.data.files.map((file) => (
                                    <li key={file.name} className="flex items-center justify-between gap-2">
                                        <span className="truncate font-mono text-xs">
                                            {file.name} <span className="text-subtle-foreground">· {f.number(Math.ceil(file.size / 1024))} KB</span>
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            render={
                                                <a href={`/translators/export?mode=${mode}&format=${format}&file=${encodeURIComponent(file.name)}`} download={file.name}>
                                                    <Download aria-hidden="true" />
                                                    {t("export.download")}
                                                </a>
                                            }
                                        />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                </DialogPanel>
            </DialogPopup>
        </Dialog>
    );
}
