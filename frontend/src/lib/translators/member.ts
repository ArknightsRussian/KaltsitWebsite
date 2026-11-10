/**
 * Whether the signed-in user is a member of the translators' section
 * (`translators.members`). The header shows the section's menu item only
 * then; a visitor who is signed out never asks the backend.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "#/hooks/use-auth";
import { translatorsMeQueryOptions } from "./api";

export function useTranslatorsMember(): boolean {
    const { user } = useAuth();
    const me = useQuery({ ...translatorsMeQueryOptions(), enabled: Boolean(user) });
    return Boolean(user && me.data?.member);
}
