import type { Scene } from "@/types";
import type { L, MockLine } from "./types";

// Tiny constructors that keep the preset files readable.

export const l = (id: string, en: string): L => ({ id, en });

export const line = (
  speaker: string,
  voiceType: string,
  age: string,
  emotion: string,
  pacing: string,
  id: string,
  en: string,
): MockLine => ({ speaker, voiceType, age, emotion, pacing, text: { id, en } });

export const music = (
  genre: string,
  mood: string,
  bpm: number,
  instrumentation: string[],
  intensity: Scene["music"]["intensity"],
  direction: string,
): Scene["music"] => ({ genre, mood, bpm, instrumentation, intensity, direction });

export const sfx = (sound: string, detail: string, timing: string): Scene["sfx"][number] => ({ sound, detail, timing });

export const cam = (
  shot: string,
  angle: string,
  lens: string,
  framing: string,
  movement: string,
  focus: string,
): Scene["camera"] => ({ shot, angle, lens, framing, movement, focus });
