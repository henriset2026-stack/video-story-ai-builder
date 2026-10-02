import { z } from "zod";
import { ASPECT_RATIOS, DEFAULT_SETTINGS, DURATIONS, GENRES, LANGUAGES, MAX_SCENES, MIN_SCENES } from "@/lib/constants";

// Per-browser default generation settings (Settings page → Create form). Convenience only:
// storage may be unavailable (private mode, blocked site data), so every access is guarded.

const KEY = "vsab:defaults";
const EVENT = "vsab:defaults-changed";

export const PreferencesSchema = z.object({
  genre: z.enum(GENRES),
  duration: z.number().refine((v) => (DURATIONS as readonly number[]).includes(v)),
  aspectRatio: z.enum(ASPECT_RATIOS),
  language: z.enum(LANGUAGES),
  sceneCount: z.number().int().min(MIN_SCENES).max(MAX_SCENES),
});
export type Preferences = z.infer<typeof PreferencesSchema>;

export const FACTORY_DEFAULTS: Preferences = { ...DEFAULT_SETTINGS };

/** Raw stored string (stable identity for useSyncExternalStore). */
export function readPreferencesRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function parsePreferences(raw: string | null): Preferences {
  if (!raw) return FACTORY_DEFAULTS;
  try {
    const parsed = PreferencesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : FACTORY_DEFAULTS;
  } catch {
    return FACTORY_DEFAULTS;
  }
}

export function savePreferences(prefs: Preferences | null): boolean {
  try {
    if (prefs) window.localStorage.setItem(KEY, JSON.stringify(prefs));
    else window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch {
    return false;
  }
}

export function subscribePreferences(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
