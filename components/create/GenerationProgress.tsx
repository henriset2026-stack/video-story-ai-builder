"use client";

import { GENERATION_STEPS, type GenerationStepId } from "@/lib/constants";
import type { StepStatus } from "@/types";

const STATUS_TEXT: Record<StepStatus, string> = {
  pending: "Waiting",
  running: "In progress",
  done: "Done",
  error: "Failed",
};

function Marker({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <svg viewBox="0 0 16 16" className="size-4 text-tungsten" aria-hidden="true">
        <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }
  if (status === "running") {
    return <span className="block size-3 animate-pulse rounded-full bg-tungsten" aria-hidden="true" />;
  }
  if (status === "error") {
    return (
      <svg viewBox="0 0 16 16" className="size-4 text-slate-red" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }
  return <span className="block size-2 rounded-full bg-line" aria-hidden="true" />;
}

export function GenerationProgress({ steps }: { steps: Record<GenerationStepId, StepStatus> }) {
  const done = GENERATION_STEPS.filter((s) => steps[s.id] === "done").length;
  const running = GENERATION_STEPS.filter((s) => steps[s.id] === "running");

  return (
    <section aria-labelledby="progress-heading" className="rounded border border-line bg-graphite-2 p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="progress-heading" className="type-billing text-3xl">
          Creating your video story
        </h2>
        <p className="text-sm text-fog">
          {done} of {GENERATION_STEPS.length}
        </p>
      </div>
      <div
        className="mt-4 h-1 overflow-hidden rounded bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={GENERATION_STEPS.length}
        aria-valuenow={done}
        aria-label="Generation progress"
      >
        <div className="h-full bg-tungsten transition-[width] duration-500" style={{ width: `${(done / GENERATION_STEPS.length) * 100}%` }} />
      </div>
      <p className="sr-only" aria-live="polite">
        {running.length ? `${running.map((s) => s.label).join(", ")}…` : ""}
      </p>
      <ol className="mt-5 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
        {GENERATION_STEPS.map((step, i) => {
          const status = steps[step.id];
          return (
            <li key={step.id} className="flex items-center gap-3">
              <span className="flex size-5 items-center justify-center">
                <Marker status={status} />
              </span>
              <span className={status === "pending" ? "text-fog" : "text-chalk"}>
                <span className="mr-2 text-fog">{i + 1}.</span>
                {step.label}
              </span>
              <span className="sr-only">— {STATUS_TEXT[status]}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
