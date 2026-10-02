"use client";

import { useState, useSyncExternalStore } from "react";
import { SettingsFields } from "@/components/create/SettingsFields";
import {
  FACTORY_DEFAULTS,
  parsePreferences,
  readPreferencesRaw,
  savePreferences,
  subscribePreferences,
  type Preferences,
} from "@/lib/client/preferences";
import { MIN_SECONDS_PER_SCENE } from "@/lib/constants";

export function DefaultsForm() {
  const raw = useSyncExternalStore(subscribePreferences, readPreferencesRaw, () => null);
  // The message lives here so it survives the remount that follows a save.
  const [message, setMessage] = useState("");
  return <Inner key={raw ?? "factory"} initial={parsePreferences(raw)} message={message} setMessage={setMessage} />;
}

function Inner({
  initial,
  message,
  setMessage,
}: {
  initial: Preferences;
  message: string;
  setMessage: (m: string) => void;
}) {
  const [value, setValue] = useState(initial);

  function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage(
      savePreferences(value)
        ? "Defaults saved. New videos start with these settings."
        : "Couldn’t save — this browser is blocking site storage.",
    );
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <SettingsFields
        value={value}
        onChange={(next) => {
          setValue({ ...next, sceneCount: Math.min(next.sceneCount, Math.floor(next.duration / MIN_SECONDS_PER_SCENE)) });
          setMessage("");
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="rounded bg-tungsten px-5 py-2.5 font-semibold text-ink hover:bg-[#f3bd5e]">
          Save defaults
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(FACTORY_DEFAULTS);
            setMessage(savePreferences(null) ? "Restored the original defaults." : "Couldn’t reset — this browser is blocking site storage.");
          }}
          className="rounded px-4 py-2.5 text-fog hover:text-chalk"
        >
          Restore original defaults
        </button>
        <p aria-live="polite" className="text-sm text-fog">
          {message}
        </p>
      </div>
    </form>
  );
}
