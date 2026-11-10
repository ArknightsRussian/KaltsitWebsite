/**
 * The Service rows in words: a story's stage commands as "Music: escape",
 * "On stage: Amiya", "Fade out", "Pause" instead of raw commands with their
 * parameters. A command this list does not know shows by its name only;
 * the same words twice in a row show once.
 */
import type { TypedT } from "#/lib/i18n/messages";
import type { StoryCommand } from "#/types/generated/StoryCommand";
import type { messages } from "./translators.messages";

type T = TypedT<typeof messages>;

/** The command kinds the import turns into lines; every other kind is a stage command. */
export const DISPLAYED_KINDS = new Set(["name", "multiline", "text", "narration", "dialog", "voicewithin", "subtitle", "sticker", "decision"]);

/** Commands with nothing to say to a translator. */
const SILENT = new Set(["header", "stickerclear", "subtitleclear", "hidedialog", "showdialog", "skipnode", "skiptonode"]);

/** A sprite id without pose and face, as the backend names it: `char_002_amiya_1#3` -> `char_002_amiya`. */
export function charBase(id: string): string {
    const plain = id.trim().split("#")[0].toLowerCase();
    const parts = plain.split("_");
    return parts.length >= 4 && /^\d+$/.test(parts[parts.length - 1]) ? parts.slice(0, -1).join("_") : plain;
}

/** An asset key as a short name: `$escape_loop` -> `escape`. */
function assetName(key: string | undefined): string {
    return (key ?? "")
        .replace(/^\$/, "")
        .replace(/_(loop|intro|combine)$/i, "")
        .trim();
}

export function describeCommand(cmd: StoryCommand, t: T, nameOf: (charId: string) => string): string | null {
    const a = (k: string) => {
        const v = cmd.args[k];
        return v === undefined || v === "" ? undefined : v;
    };
    switch (cmd.kind) {
        case "playmusic":
            return t("service.music", { name: assetName(a("key") ?? a("intro")) });
        case "stopmusic":
            return t("service.musicStop");
        case "playsound":
            return t("service.sound", { name: assetName(a("key")) });
        case "stopsound":
            return t("service.soundStop");
        case "background":
        case "largebg":
        case "gridbg":
        case "verticalbg":
        case "backgroundtween":
            return a("image") ? t("service.background", { name: assetName(a("image")) }) : t("service.backgroundClear");
        case "image":
        case "imagetween":
            return a("image") ? t("service.image", { name: assetName(a("image")) }) : t("service.imageClear");
        case "character":
        case "charslot": {
            const who = [a("name"), a("name2")].filter((v): v is string => Boolean(v)).map(nameOf);
            return who.length > 0 ? t("service.onStage", { names: who.join(", ") }) : t("service.stageClear");
        }
        case "blocker":
            return Number(a("a") ?? "0") > 0 ? t("service.fadeOut") : t("service.fadeIn");
        case "camerashake":
            return t("service.shake");
        case "cameraeffect":
            return t("service.cameraEffect");
        case "delay":
            return t("service.pause");
        case "predicate":
            return t("service.branch", { options: (a("references") ?? "").replaceAll(";", ", ") });
        case "video":
        case "playvideo":
            return t("service.video");
        case "musicvolume":
        case "soundvolume":
            return t("service.volume");
        default:
            return SILENT.has(cmd.kind) ? null : t("service.other", { name: cmd.kind });
    }
}

/** A run of stage commands as one line of words. */
export function describeCommands(commands: readonly StoryCommand[], t: T, nameOf: (charId: string) => string): string {
    const out: string[] = [];
    for (const c of commands) {
        const words = describeCommand(c, t, nameOf);
        if (words && out[out.length - 1] !== words) out.push(words);
    }
    return out.join(" · ");
}
