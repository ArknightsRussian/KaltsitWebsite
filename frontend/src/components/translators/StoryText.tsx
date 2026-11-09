/**
 * A story text in the translators' section: the story markup (italics,
 * colour, paragraphs) as the reader renders it, `{@nickname}` as a chip with
 * the signed-in member's nickname (the saved text keeps the token as it is),
 * and the fragments quoted by comments highlighted.
 */
import type React from "react";
import { Badge } from "#/components/ui/badge";
import { parseStoryText, type TextNode } from "#/lib/story/text";

/** A private-use character standing for `{@nickname}` while the markup is parsed. */
const NICK = String.fromCharCode(0xe000);
const NICK_TOKEN = /\{@nickname\}/gi;

/** The text with the story's substitutions, the nickname kept as a marker. */
function prepare(text: string): string {
    return text
        .replace(NICK_TOKEN, NICK)
        .replace(/\{@nbs\}/g, String.fromCharCode(0xa0))
        .replace(/\\n/g, "\n");
}

export function NicknameChip({ nickname }: { nickname: string }): React.ReactElement {
    return (
        <Badge variant="tint" size="sm" className="mx-0.5 align-baseline" data-token="{@nickname}">
            {nickname}
        </Badge>
    );
}

/** Split a plain run by the quotes (each marked) and the nickname marker (a chip). */
function renderRun(value: string, nickname: string, quotes: readonly string[], key: string): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    const quote = quotes.find((q) => q && value.includes(q));
    if (quote) {
        const at = value.indexOf(quote);
        out.push(...renderRun(value.slice(0, at), nickname, quotes, `${key}a`));
        out.push(
            <mark key={`${key}m`} className="rounded-sm bg-warning/20 text-foreground">
                {renderRun(quote, nickname, [], `${key}q`)}
            </mark>,
        );
        out.push(...renderRun(value.slice(at + quote.length), nickname, quotes, `${key}b`));
        return out;
    }
    // Keyed by where each chip stands in the run.
    let at = 0;
    for (const part of value.split(NICK)) {
        if (at > 0) out.push(<NicknameChip key={`${key}n${at}`} nickname={nickname} />);
        if (part) out.push(part);
        at += part.length + 1;
    }
    return out;
}

function renderNodes(nodes: TextNode[], nickname: string, quotes: readonly string[], prefix: string): React.ReactNode[] {
    return nodes.map((n, i) => {
        const key = `${prefix}${i}`;
        if (n.kind === "text") return <span key={key}>{renderRun(n.value, nickname, quotes, key)}</span>;
        const children = renderNodes(n.children, nickname, quotes, `${key}.`);
        if (n.kind === "inline") return n.tag === "i" ? <em key={key}>{children}</em> : n.tag === "b" ? <strong key={key}>{children}</strong> : <u key={key}>{children}</u>;
        if (n.kind === "color")
            return (
                <span key={key} style={{ color: n.color }}>
                    {children}
                </span>
            );
        return (
            <span key={key} className="block">
                {children}
            </span>
        );
    });
}

export interface IStoryTextProps {
    text: string;
    /** Shown for `{@nickname}`. */
    nickname: string;
    /** Fragments to highlight (comments' quotes). */
    quotes?: readonly string[];
}

export function StoryText({ text, nickname, quotes = [] }: IStoryTextProps): React.ReactElement {
    // A quote is the selected text, where the chip read as the nickname.
    const marks = quotes.map((q) => q.replaceAll(nickname, NICK));
    return <span className="whitespace-pre-line">{renderNodes(parseStoryText(prepare(text)), nickname, marks, "t")}</span>;
}
