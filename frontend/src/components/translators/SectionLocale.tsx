/**
 * The translators' section speaks Russian by default, whatever the site's
 * language: its `translators` messages come from the project's i18n for the
 * `ru` locale. When the site itself runs in `ru`, the catalog from the
 * backend (the admin panel's edits) wins; otherwise the Russian shipped with
 * the section (`translators.ru.json`, the same texts `translators/i18n-ru.py`
 * loads into the backend) stands in. A member can switch the section to
 * English (kept in this browser).
 */
import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import { I18nProvider, useI18n } from "#/lib/i18n";
import ru from "./translators.ru.json";

export type SectionLang = "ru" | "en";

const STORAGE_KEY = "translators.lang";

const LangContext = createContext<{ lang: SectionLang; setLang: (lang: SectionLang) => void }>({ lang: "ru", setLang: () => {} });

/** The section's Russian, keyed as the catalog is (`translators.…`). */
const RU: Record<string, string> = Object.fromEntries(Object.entries(ru as Record<string, string>).map(([k, v]) => [`translators.${k}`, v]));

export function SectionLocale({ children }: { children: React.ReactNode }): React.ReactElement {
    const site = useI18n();
    const [lang, setLangState] = useState<SectionLang>("ru");
    useEffect(() => {
        try {
            if (window.localStorage.getItem(STORAGE_KEY) === "en") setLangState("en");
        } catch {
            // No storage (private window): Russian, as by default.
        }
    }, []);
    const setLang = useCallback((next: SectionLang) => {
        setLangState(next);
        try {
            window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Kept for this visit only.
        }
    }, []);
    const messages = useMemo(() => (site.locale === "ru" ? { ...RU, ...site.messages } : { ...site.messages, ...RU }), [site.locale, site.messages]);
    const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
    return (
        <LangContext.Provider value={value}>
            {lang === "ru" ? (
                <I18nProvider locale="ru" available={site.available} messages={messages} gamedataServer={site.gamedataServer} localeGamedataServer={site.localeGamedataServer} gamedataServerPicked={site.gamedataServerPicked} gamedataServers={site.gamedataServers}>
                    {children}
                </I18nProvider>
            ) : (
                children
            )}
        </LangContext.Provider>
    );
}

/** RU | EN for the section, labelled in both languages. */
export function SectionLangSwitch({ label }: { label: string }): React.ReactElement {
    const { lang, setLang } = useContext(LangContext);
    return (
        <ToggleGroup aria-label={label} value={[lang]} onValueChange={(v: string[]) => v[0] && setLang(v[0] as SectionLang)} size="sm" variant="outline">
            <ToggleGroupItem value="ru" lang="ru">
                RU
            </ToggleGroupItem>
            <ToggleGroupItem value="en" lang="en">
                EN
            </ToggleGroupItem>
        </ToggleGroup>
    );
}
