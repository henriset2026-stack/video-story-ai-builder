"use client";

import { useId, useRef, useState } from "react";

interface PromptBlockProps {
  title: string;
  content: string;
  /** Show the copy button (default true). */
  copyButton?: boolean;
  /** Visually de-emphasised blocks (e.g. negative prompts). */
  tone?: "default" | "quiet";
}

type CopyState = "idle" | "copied" | "failed";

/** A copy-ready prompt set like a screenplay page: Courier on paper, one-click copy. */
export function PromptBlock({ title, content, copyButton = true, tone = "default" }: PromptBlockProps) {
  const id = useId();
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setState("copied");
    } catch {
      // Clipboard can be blocked (insecure context, permissions). Select the text so the user can copy it.
      const selection = window.getSelection();
      if (textRef.current && selection) {
        const range = document.createRange();
        range.selectNodeContents(textRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2200);
  }

  return (
    <section aria-labelledby={`${id}-title`} className={tone === "quiet" ? "rounded border border-rule/70 bg-sheet-2/60" : "sheet"}>
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5">
        <h4 id={`${id}-title`} className="text-sm font-semibold text-ink">
          {title}
        </h4>
        {copyButton && (
          <button
            type="button"
            onClick={copy}
            className="min-w-24 rounded border border-ink/25 px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-ink hover:bg-ink hover:text-sheet"
            aria-describedby={`${id}-status`}
          >
            {state === "copied" ? "Copied ✓" : "Copy"}
          </button>
        )}
      </div>
      <p ref={textRef} className="whitespace-pre-wrap break-words px-4 py-3.5 font-script text-[15px] leading-relaxed text-ink">
        {content}
      </p>
      <p id={`${id}-status`} aria-live="polite" className={state === "failed" ? "px-4 pb-3 text-sm text-slate-red-deep" : "sr-only"}>
        {state === "copied" ? `${title} copied to clipboard` : state === "failed" ? "Couldn’t access the clipboard — the text is selected, press Ctrl+C or ⌘C." : ""}
      </p>
    </section>
  );
}
