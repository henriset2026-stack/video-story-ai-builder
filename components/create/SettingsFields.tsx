"use client";

import { useId } from "react";
import {
  ASPECT_RATIO_LABELS,
  ASPECT_RATIOS,
  DURATIONS,
  GENRES,
  LANGUAGES,
  MAX_SCENES,
  MIN_SCENES,
  MIN_SECONDS_PER_SCENE,
} from "@/lib/constants";
import type { Preferences } from "@/lib/client/preferences";

interface Props {
  value: Preferences;
  onChange: (next: Preferences) => void;
  disabled?: boolean;
  sceneError?: string;
}

const selectClass =
  "w-full rounded border border-line bg-graphite-2 px-3 py-2.5 text-chalk hover:border-fog disabled:opacity-60";

export function SettingsFields({ value, onChange, disabled, sceneError }: Props) {
  const id = useId();
  const set = <K extends keyof Preferences>(key: K, v: Preferences[K]) => onChange({ ...value, [key]: v });

  return (
    <fieldset disabled={disabled} className="grid grid-cols-2 gap-4 md:grid-cols-5">
      <legend className="sr-only">Video settings</legend>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-genre`} className="text-sm text-fog">Genre</label>
        <select id={`${id}-genre`} className={selectClass} value={value.genre} onChange={(e) => set("genre", e.target.value as Preferences["genre"])}>
          {GENRES.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-duration`} className="text-sm text-fog">Duration</label>
        <select id={`${id}-duration`} className={selectClass} value={value.duration} onChange={(e) => set("duration", Number(e.target.value))}>
          {DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d} seconds
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-aspect`} className="text-sm text-fog">Aspect ratio</label>
        <select
          id={`${id}-aspect`}
          className={selectClass}
          value={value.aspectRatio}
          onChange={(e) => set("aspectRatio", e.target.value as Preferences["aspectRatio"])}
        >
          {ASPECT_RATIOS.map((a) => (
            <option key={a} value={a}>
              {ASPECT_RATIO_LABELS[a]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-language`} className="text-sm text-fog">Language</label>
        <select
          id={`${id}-language`}
          className={selectClass}
          value={value.language}
          onChange={(e) => set("language", e.target.value as Preferences["language"])}
        >
          {LANGUAGES.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-scenes`} className="text-sm text-fog">Scenes</label>
        <select
          id={`${id}-scenes`}
          className={selectClass}
          value={value.sceneCount}
          aria-invalid={sceneError ? true : undefined}
          aria-describedby={sceneError ? `${id}-scenes-error` : undefined}
          onChange={(e) => set("sceneCount", Number(e.target.value))}
        >
          {Array.from({ length: MAX_SCENES - MIN_SCENES + 1 }, (_, i) => i + MIN_SCENES).map((n) => (
            <option key={n} value={n} disabled={value.duration / n < MIN_SECONDS_PER_SCENE}>
              {n} {n === 1 ? "scene" : "scenes"}
            </option>
          ))}
        </select>
        {sceneError && (
          <p id={`${id}-scenes-error`} className="text-sm text-slate-red">
            {sceneError}
          </p>
        )}
      </div>
    </fieldset>
  );
}
