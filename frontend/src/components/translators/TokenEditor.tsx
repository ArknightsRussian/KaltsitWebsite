/**
 * The proposal editor's text box: plain text where every substitution token
 * (`{@nickname}`, `{0}`, `{@nbs}`) is one chip that cannot be split or typed
 * into: it can only be removed whole or inserted again with the button. The
 * value is the text with the tokens as they are. Ctrl+Enter submits, Esc
 * cancels. It looks like the kit's field (border, focus ring).
 */
import { AtSign } from "lucide-react";
import type React from "react";
import { useEffect, useRef } from "react";
import { badgeVariants } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

const TOKEN = /\{@?[A-Za-z0-9_]+\}/g;

/** The tokens in a text, in order (to tell a lost one). */
export function tokensOf(text: string): string[] {
    return text.match(TOKEN) ?? [];
}

function chip(token: string, nickname: string): HTMLElement {
    const el = document.createElement("span");
    el.contentEditable = "false";
    el.dataset.token = token;
    el.className = cn(badgeVariants({ variant: "tint", size: "sm" }), "mx-0.5 select-none align-baseline");
    el.textContent = token.toLowerCase() === "{@nickname}" ? nickname : token;
    return el;
}

function fill(el: HTMLElement, text: string, nickname: string): void {
    const nodes: Node[] = [];
    let last = 0;
    for (const m of text.matchAll(TOKEN)) {
        const at = m.index ?? 0;
        if (at > last) nodes.push(document.createTextNode(text.slice(last, at)));
        nodes.push(chip(m[0], nickname));
        last = at + m[0].length;
    }
    if (last < text.length) nodes.push(document.createTextNode(text.slice(last)));
    el.replaceChildren(...nodes);
}

/** The text back from the box: chips as their tokens, line breaks as LF. */
function serialize(node: Node): string {
    let out = "";
    node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) out += child.textContent ?? "";
        else if (child instanceof HTMLElement) {
            if (child.dataset.token) out += child.dataset.token;
            else if (child.tagName === "BR") out += "\n";
            else {
                // A browser may wrap a new line in a block.
                if ((child.tagName === "DIV" || child.tagName === "P") && out && !out.endsWith("\n")) out += "\n";
                out += serialize(child);
            }
        }
    });
    return out;
}

export interface ITokenEditorProps {
    id: string;
    initial: string;
    nickname: string;
    onChange: (text: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
    /** Accessible name of the "insert nickname" button. */
    insertLabel: string;
    describedBy?: string;
}

export function TokenEditor({ id, initial, nickname, onChange, onSubmit, onCancel, insertLabel, describedBy }: ITokenEditorProps): React.ReactElement {
    const ref = useRef<HTMLDivElement>(null);
    // Filled once: React does not own the box's content, so typing never jumps the caret.
    // biome-ignore lint/correctness/useExhaustiveDependencies: the initial text only
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        fill(el, initial, nickname);
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
    }, []);

    const changed = () => {
        if (ref.current) onChange(serialize(ref.current));
    };

    const insertNickname = () => {
        const el = ref.current;
        if (!el) return;
        const sel = window.getSelection();
        let range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
        if (!range || !el.contains(range.startContainer)) {
            range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
        }
        const node = chip("{@nickname}", nickname);
        range.deleteContents();
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
        el.focus();
        changed();
    };

    return (
        <div className="flex flex-col gap-1">
            {/* biome-ignore lint/a11y/useSemanticElements: a textarea cannot hold the token chips */}
            <div
                ref={ref}
                id={id}
                role="textbox"
                aria-multiline="true"
                aria-describedby={describedBy}
                tabIndex={0}
                contentEditable="plaintext-only"
                suppressContentEditableWarning
                onInput={changed}
                onPaste={(e) => {
                    // Plain text only, also where `plaintext-only` is not supported.
                    e.preventDefault();
                    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        onSubmit();
                    } else if (e.key === "Escape") {
                        e.preventDefault();
                        onCancel();
                    }
                }}
                className="min-h-16 w-full whitespace-pre-wrap rounded-lg border border-input bg-background px-3 py-1.5 text-base shadow-xs/5 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring sm:text-sm dark:bg-input/32"
            />
            <div>
                <Button variant="ghost" size="xs" onClick={insertNickname} onMouseDown={(e) => e.preventDefault()}>
                    <AtSign aria-hidden="true" />
                    {insertLabel}
                </Button>
            </div>
        </div>
    );
}
