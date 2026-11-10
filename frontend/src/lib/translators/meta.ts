import type { messages } from "#/components/translators/translators.messages";
import { DEFAULT_LOCALE, formatMessage, type MessageValues, sourceMessage } from "#/lib/i18n";
import { fullMessageKey, type TypedT } from "#/lib/i18n/messages";
import type { IMetaSource } from "#/lib/meta";

/**
 * The `translators` namespace without a hook, for the section's route `head()`,
 * resolved the way `metaT` resolves `meta`: the locale's text, then the bundled
 * English, then the key. Kept in the section so `meta.messages.ts` stays upstream's.
 */
export function translatorsHeadT(source?: IMetaSource | null): TypedT<typeof messages> {
    return (key, values?: MessageValues) => {
        const full = fullMessageKey("translators", key);
        const message = source?.messages[full] ?? sourceMessage(full) ?? full;
        return formatMessage(message, source?.locale ?? DEFAULT_LOCALE, values);
    };
}
