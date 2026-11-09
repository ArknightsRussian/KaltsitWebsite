/**
 * `/translators/export?mode=…&format=…[&file=…]`: the translators' export as
 * a download — the whole ZIP archive, or one file of it. A server route rather than a server function: a
 * patched dictionary is tens of megabytes, which a page should not carry as
 * a JSON string. The site's sign-in cookie goes to the backend, which answers
 * a member only (and `approved` to the lead only).
 */
import { createFileRoute } from "@tanstack/react-router";
import { backendFetch } from "#/lib/fetch";
import type { ExportResult } from "#/types/generated/ExportResult";

function cookie(request: Request, name: string): string | undefined {
    for (const part of (request.headers.get("cookie") ?? "").split(";")) {
        const [k, ...v] = part.trim().split("=");
        if (k === name) return decodeURIComponent(v.join("="));
    }
    return undefined;
}

const SAFE_NAME = /^[A-Za-z0-9_.-]+$/;

export const Route = createFileRoute("/translators_/export")({
    server: {
        handlers: {
            GET: async ({ request }) => {
                const url = new URL(request.url);
                const mode = url.searchParams.get("mode") === "approved" ? "approved" : "review";
                const format = url.searchParams.get("format") === "patch" ? "patch" : "file";
                const file = url.searchParams.get("file") ?? "";
                const bearerToken = cookie(request, "site_token");
                // No file named: the whole archive — the one packed for the prepared report (token).
                if (file === "") {
                    const token = (url.searchParams.get("token") ?? "").replace(/[^0-9a-f]/g, "");
                    const res = await backendFetch(`/translators/export/archive?mode=${mode}&format=${format}${token ? `&token=${token}` : ""}`, { bearerToken });
                    if (!res.ok) return new Response(await res.text(), { status: res.status });
                    return new Response(await res.arrayBuffer(), {
                        headers: {
                            "Content-Type": "application/zip",
                            "Content-Disposition": res.headers.get("content-disposition") ?? 'attachment; filename="translators.zip"',
                            "Cache-Control": "no-store",
                        },
                    });
                }
                if (!SAFE_NAME.test(file)) return new Response("Bad file name", { status: 400 });
                const res = await backendFetch(`/translators/export?mode=${mode}&format=${format}&only=${encodeURIComponent(file)}`, { bearerToken });
                if (!res.ok) return new Response(await res.text(), { status: res.status });
                const data = (await res.json()) as ExportResult;
                const found = data.files.find((f) => f.name === file);
                if (!found) return new Response("Not found", { status: 404 });
                const type = file.endsWith(".tsv") ? "text/tab-separated-values" : "text/plain";
                return new Response(found.content, {
                    headers: {
                        "Content-Type": `${type}; charset=utf-8`,
                        "Content-Disposition": `attachment; filename="${file}"`,
                        "Cache-Control": "no-store",
                    },
                });
            },
        },
    },
});
