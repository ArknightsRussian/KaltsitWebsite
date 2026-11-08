/**
 * The translators' section (`/translators`): its backend calls, under
 * `/api/translators`. Every call goes through a server function so the
 * http-only `site_token` reaches the backend: the section's data is only
 * answered to a member (`translators.members`).
 */
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { env } from "#/env";
import { parseError } from "#/lib/api/_shared";
import { optionalSiteToken } from "#/lib/api/_shared.server";
import { backendFetch } from "#/lib/fetch";
import type { Glossary } from "#/types/generated/Glossary";
import type { LoginResponse } from "#/types/generated/LoginResponse";
import type { TranslatorStoryLines } from "#/types/generated/TranslatorStoryLines";
import type { TranslatorsMe } from "#/types/generated/TranslatorsMe";

/** Every query of the section starts with this, so one invalidation refreshes them all (sign-in, sign-out). */
export const TRANSLATORS_QUERY_ROOT = ["translators"] as const;

export const getTranslatorsMeFn = createServerFn({ method: "GET" }).handler(async (): Promise<TranslatorsMe> => {
    const res = await backendFetch("/translators/me", { bearerToken: optionalSiteToken() });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as TranslatorsMe;
});

export function translatorsMeQueryOptions() {
    return queryOptions({ queryKey: [...TRANSLATORS_QUERY_ROOT, "me"], queryFn: () => getTranslatorsMeFn(), staleTime: 60_000 });
}

export const getTranslatorLinesFn = createServerFn({ method: "GET" })
    .inputValidator((d: { storyId: string }) => d)
    .handler(async ({ data }): Promise<TranslatorStoryLines> => {
        const res = await backendFetch(`/translators/stories/${encodeURIComponent(data.storyId)}/lines`, { bearerToken: optionalSiteToken() });
        if (!res.ok) throw await parseError(res);
        return (await res.json()) as TranslatorStoryLines;
    });

export function translatorLinesQueryOptions(storyId: string) {
    return queryOptions({ queryKey: [...TRANSLATORS_QUERY_ROOT, "lines", storyId], queryFn: () => getTranslatorLinesFn({ data: { storyId } }), staleTime: 5 * 60_000 });
}

export const getGlossaryFn = createServerFn({ method: "GET" }).handler(async (): Promise<Glossary> => {
    const res = await backendFetch("/translators/glossary", { bearerToken: optionalSiteToken() });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as Glossary;
});

/** The stored glossary; polled every 2 s while a download runs. */
export function glossaryQueryOptions() {
    return queryOptions({
        queryKey: [...TRANSLATORS_QUERY_ROOT, "glossary"],
        queryFn: () => getGlossaryFn(),
        staleTime: 5 * 60_000,
        refetchInterval: (query) => (query.state.data?.refreshing ? 2_000 : false),
    });
}

/** Download the glossary again from the team's sheet (in the background); answers the stored copy with `refreshing` set. */
export const refreshGlossaryFn = createServerFn({ method: "POST" }).handler(async (): Promise<Glossary> => {
    const res = await backendFetch("/translators/glossary/refresh", { method: "POST", bearerToken: optionalSiteToken() });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as Glossary;
});

// The same cookies the site's own sign-in sets (`lib/auth/server.ts`), so the
// rest of the site sees the development translator as signed in.
const COOKIE_BASE = { secure: env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 7 };

/**
 * Development only: sign in as the local translator account. The backend
 * answers 404 unless `TRANSLATORS_DEV_LOGIN=1` is set for it.
 */
export const translatorsDevLoginFn = createServerFn({ method: "POST" }).handler(async (): Promise<{ uid: string }> => {
    const res = await backendFetch("/translators/dev-login", { method: "POST" });
    if (!res.ok) throw await parseError(res);
    const { token, uid } = (await res.json()) as LoginResponse;
    setCookie("site_token", token, { ...COOKIE_BASE, httpOnly: true });
    setCookie("auth_indicator", "1", { ...COOKIE_BASE, httpOnly: false });
    return { uid };
});
