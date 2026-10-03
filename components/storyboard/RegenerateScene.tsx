"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { INSTRUCTION_MAX_LENGTH } from "@/lib/constants";

const SUGGESTIONS = [
  "Make the scene more emotional.",
  "Change the location to Jakarta.",
  "Make the camera movement slower.",
  "Make the lighting more dramatic.",
];

type Status = { kind: "idle" } | { kind: "working" } | { kind: "done" } | { kind: "error"; message: string };

export function RegenerateScene({ sceneId, sceneNumber }: { sceneId: string; sceneNumber: number }) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [refreshing, startRefresh] = useTransition();
  const working = status.kind === "working" || refreshing;

  async function regenerate(event: React.FormEvent) {
    event.preventDefault();
    setStatus({ kind: "working" });
    try {
      const res = await fetch(`/api/scenes/${sceneId}/regenerate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction: instruction.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus({ kind: "error", message: data?.error?.message ?? "Something went wrong. Please try again." });
        return;
      }
      setStatus({ kind: "done" });
      setOpen(false);
      setInstruction("");
      startRefresh(() => router.refresh());
    } catch {
      setStatus({ kind: "error", message: "Connection lost. Check your internet connection and try again." });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={() => setOpen((o) => !o)}
          disabled={working}
          className="rounded border border-line px-4 py-2.5 text-sm font-semibold text-chalk transition-colors hover:border-tungsten disabled:opacity-60"
        >
          {working ? `Rewriting scene ${sceneNumber}…` : "Regenerate scene"}
        </button>
        <p aria-live="polite" className="text-sm text-fog">
          {status.kind === "done" && !refreshing ? `Scene ${sceneNumber} was regenerated. Everything else stayed the same.` : ""}
        </p>
      </div>

      {open && (
        <form id={`${id}-panel`} onSubmit={regenerate} className="flex flex-col gap-3 rounded border border-line bg-graphite p-4">
          <label htmlFor={`${id}-instruction`} className="font-semibold text-chalk">
            What would you like to change?
          </label>
          <p id={`${id}-hint`} className="-mt-2 text-sm text-fog">
            Optional. Characters, visual style and the other scenes stay locked.
          </p>
          <textarea
            id={`${id}-instruction`}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            maxLength={INSTRUCTION_MAX_LENGTH}
            rows={3}
            autoFocus
            aria-describedby={`${id}-hint`}
            disabled={working}
            className="rounded border border-line bg-graphite-2 p-3 text-chalk placeholder:text-fog/70"
            placeholder="Describe the change, or leave empty for a fresh take on this scene."
          />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Suggestions">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInstruction(s)}
                disabled={working}
                className="rounded-full border border-line px-3 py-1 text-sm text-fog hover:border-fog hover:text-chalk"
              >
                {s}
              </button>
            ))}
          </div>
          {status.kind === "error" && (
            <p role="alert" className="text-sm text-slate-red">
              {status.message}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={working}
              className="rounded bg-tungsten px-4 py-2.5 text-sm font-semibold text-ink hover:bg-[#f3bd5e] disabled:opacity-60"
            >
              {working ? "Regenerating…" : `Regenerate scene ${sceneNumber}`}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={working}
              className="rounded px-4 py-2.5 text-sm text-fog hover:text-chalk"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
