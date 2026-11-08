import { createFileRoute } from "@tanstack/react-router";
import type React from "react";
import { TranslatorsBook } from "#/components/translators/TranslatorsBook";
import { RouteError } from "#/components/ui/route-error";
import { seo } from "#/lib/seo";
import { translatorsHeadT } from "#/lib/translators/meta";

export const Route = createFileRoute("/translators_/book")({
    component: RouteComponent,
    errorComponent: RouteError,
    validateSearch: (search: Record<string, unknown>): { group?: string; story?: string } => {
        const out: { group?: string; story?: string } = {};
        if (typeof search.group === "string" && search.group) out.group = search.group;
        if (typeof search.story === "string" && search.story) out.story = search.story;
        return out;
    },
    head: ({ match }) => {
        const t = translatorsHeadT(match.context.i18n);
        const { meta, links } = seo({ title: t("meta.title"), path: "/translators/book", locale: match.context.i18n?.locale });
        return {
            meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }, { name: "robots", content: "noindex" }, ...meta],
            links,
        };
    },
});

function RouteComponent(): React.ReactElement {
    const { group, story } = Route.useSearch();
    return <TranslatorsBook group={group} story={story} />;
}
