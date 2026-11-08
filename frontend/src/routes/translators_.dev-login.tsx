import { createFileRoute } from "@tanstack/react-router";
import { DevLoginPage } from "#/components/translators/DevLoginPage";
import { RouteError } from "#/components/ui/route-error";
import { seo } from "#/lib/seo";
import { translatorsHeadT } from "#/lib/translators/meta";

export const Route = createFileRoute("/translators_/dev-login")({
    component: DevLoginPage,
    errorComponent: RouteError,
    head: ({ match }) => {
        const t = translatorsHeadT(match.context.i18n);
        const { meta, links } = seo({ title: t("dev.title"), path: "/translators/dev-login", locale: match.context.i18n?.locale });
        return {
            meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }, { name: "robots", content: "noindex" }, ...meta],
            links,
        };
    },
});
