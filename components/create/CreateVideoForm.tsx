"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useSyncExternalStore } from "react";
import { GENERATION_STEPS, MIN_SECONDS_PER_SCENE, THEME_MAX_LENGTH, type GenerationStepId } from "@/lib/constants";
import {
  parsePreferences,
  readPreferencesRaw,
  subscribePreferences,
  type Preferences,
} from "@/lib/client/preferences";
import { GenerationInputSchema } from "@/lib/schemas/input";
import type { GenerationEvent, StepStatus, Storyboard } from "@/types";
import { GenerationProgress } from "./GenerationProgress";
import { SettingsFields } from "./SettingsFields";

const CLIENT_TIMEOUT_MS = 6 * 60_000;
const NETWORK_ERROR = "Connection lost. Check your internet connection and try again.";
const GENERIC_ERROR = "Something went wrong while creating your story. Please try again.";
const TIMEOUT_ERROR = "The AI took too long to respond. Please try again.";

type Phase =
  | { kind: "idle" }
  | { kind: "generating" }
  | { kind: "redirecting" }
  | { kind: "unsaved"; storyboard: Storyboard; message: string; saving: boolean }
  | { kind: "error"; message: string };

const initialSteps = () =>
  Object.fromEntries(GENERATION_STEPS.map((s) => [s.id, "pending"])) as Record<GenerationStepId, StepStatus>;

/** Loads per-browser defaults (Settings page) and remounts the form once they are known. */
export function CreateVideoForm({ initialTheme }: { initialTheme: string }) {
  const raw = useSyncExternalStore(subscribePreferences, readPreferencesRaw, () => null);
  return <Form key={raw ?? "factory"} initialTheme={initialTheme} initialPrefs={parsePreferences(raw)} />;
}

function Form({ initialTheme, initialPrefs }: { initialTheme: string; initialPrefs: Preferences }) {
  const router = useRouter();
  const id = useId();
  const [theme, setTheme] = useState(initialTheme);
  const [prefs, setPrefs] = useState<Preferences>(initialPrefs);
  const [fieldErrors, setFieldErrors] = useState<{ theme?: string; sceneCount?: string }>({});
  const [steps, setSteps] = useState(initialSteps);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const busy = phase.kind === "generating" || phase.kind === "redirecting";

  function updatePrefs(next: Preferences) {
    // Keep the scene count valid when a shorter duration is chosen.
    const maxScenes = Math.floor(next.duration / MIN_SECONDS_PER_SCENE);
    setPrefs({ ...next, sceneCount: Math.min(next.sceneCount, maxScenes) });
    setFieldErrors((e) => ({ ...e, sceneCount: undefined }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = GenerationInputSchema.safeParse({ theme, ...prefs });
    if (!parsed.success) {
      const errors: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof typeof fieldErrors;
        errors[key] ??= issue.message;
      }
      setFieldErrors(errors);
      if (errors.theme) document.getElementById(`${id}-theme`)?.focus();
      return;
    }

    setFieldErrors({});
    setSteps(initialSteps());
    setPhase({ kind: "generating" });
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort("timeout"), CLIENT_TIMEOUT_MS);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        setPhase({ kind: "error", message: data?.error?.message ?? GENERIC_ERROR });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line) as GenerationEvent;
          if (evt.type === "progress") {
            setSteps((s) => ({ ...s, [evt.step]: evt.status }));
          } else if (evt.type === "error") {
            setPhase({ kind: "error", message: evt.message });
            finished = true;
          } else if (evt.type === "result") {
            finished = true;
            if (evt.projectId) {
              setPhase({ kind: "redirecting" });
              router.push(`/storyboard/${evt.projectId}`);
            } else {
              setPhase({ kind: "unsaved", storyboard: evt.storyboard, message: evt.saveError ?? "", saving: false });
            }
          }
        }
      }
      if (!finished) setPhase({ kind: "error", message: GENERIC_ERROR });
    } catch (error) {
      if (controller.signal.aborted) {
        setPhase(controller.signal.reason === "timeout" ? { kind: "error", message: TIMEOUT_ERROR } : { kind: "idle" });
      } else {
        setPhase({ kind: "error", message: error instanceof TypeError ? NETWORK_ERROR : GENERIC_ERROR });
      }
    } finally {
      clearTimeout(timer);
      abortRef.current = null;
    }
  }

  async function saveProject(storyboard: Storyboard) {
    setPhase({ kind: "unsaved", storyboard, message: "", saving: true });
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storyboard }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setPhase({ kind: "unsaved", storyboard, message: data?.error?.message ?? GENERIC_ERROR, saving: false });
        return;
      }
      setPhase({ kind: "redirecting" });
      router.push(`/storyboard/${data.project.id}`);
    } catch {
      setPhase({ kind: "unsaved", storyboard, message: NETWORK_ERROR, saving: false });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-theme`} className="type-billing text-4xl text-chalk sm:text-5xl">
            What video do you want to create?
          </label>
          <p id={`${id}-theme-hint`} className="text-fog">
            Describe your idea in a sentence or two, in any language.
          </p>
          <textarea
            id={`${id}-theme`}
            name="theme"
            value={theme}
            onChange={(e) => {
              setTheme(e.target.value);
              if (fieldErrors.theme) setFieldErrors((f) => ({ ...f, theme: undefined }));
            }}
            disabled={busy}
            rows={5}
            maxLength={THEME_MAX_LENGTH}
            required
            aria-invalid={fieldErrors.theme ? true : undefined}
            aria-describedby={`${id}-theme-hint${fieldErrors.theme ? ` ${id}-theme-error` : ""}`}
            placeholder={"Example:\nA young Indonesian entrepreneur transforms her traditional business using AI."}
            className="sheet mt-2 w-full resize-y p-5 text-lg leading-relaxed text-ink placeholder:text-ink-muted/80 disabled:opacity-70"
          />
          <div className="flex justify-between gap-4 text-sm">
            <p id={`${id}-theme-error`} className="text-slate-red" role={fieldErrors.theme ? "alert" : undefined}>
              {fieldErrors.theme}
            </p>
            <p className="shrink-0 text-fog">
              {theme.length} / {THEME_MAX_LENGTH}
            </p>
          </div>
        </div>

        <SettingsFields value={prefs} onChange={updatePrefs} disabled={busy} sceneError={fieldErrors.sceneCount} />

        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-graphite/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-tungsten px-6 py-3.5 text-base font-semibold text-ink transition-colors hover:bg-[#f3bd5e] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span aria-hidden="true">✨ </span>
            {phase.kind === "generating" ? "Creating…" : phase.kind === "redirecting" ? "Opening storyboard…" : "Create my video"}
          </button>
          {phase.kind === "generating" && (
            <button
              type="button"
              onClick={() => abortRef.current?.abort("cancel")}
              className="rounded border border-line px-5 py-3.5 text-chalk hover:border-fog"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {(phase.kind === "generating" || phase.kind === "redirecting") && <GenerationProgress steps={steps} />}

      {phase.kind === "error" && (
        <div role="alert" className="rounded border border-slate-red/60 bg-slate-red/10 p-5">
          <p className="font-semibold text-chalk">{phase.message}</p>
          <p className="mt-1 text-sm text-fog">Your idea and settings are still here. Select Create my video to try again.</p>
        </div>
      )}

      {phase.kind === "unsaved" && (
        <div role="alert" className="rounded border border-tungsten/60 bg-tungsten/10 p-5">
          <p className="font-semibold text-chalk">
            “{phase.storyboard.project.title}” is ready, but it isn’t saved yet.
          </p>
          <p className="mt-1 text-sm text-fog">
            {phase.message || "Your storyboard was created but could not be saved."} Saving again won’t regenerate it.
          </p>
          <button
            type="button"
            onClick={() => saveProject(phase.storyboard)}
            disabled={phase.saving}
            className="mt-4 rounded bg-tungsten px-5 py-3 font-semibold text-ink hover:bg-[#f3bd5e] disabled:opacity-60"
          >
            {phase.saving ? "Saving…" : "Save project"}
          </button>
        </div>
      )}
    </div>
  );
}
