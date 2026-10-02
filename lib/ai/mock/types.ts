import type { Character, Scene, SpokenLine, VisualBible } from "@/types";

/** A bilingual string: `id` = Indonesian, `en` = English. */
export interface L {
  id: string;
  en: string;
}

export type MockLine = Omit<SpokenLine, "text"> & { text: L };

export interface Beat {
  title: L;
  location: string;
  timeOfDay: string;
  purpose: L;
  emotionalBeat: L;
  action: L;
  characters: string[];
  camera: Scene["camera"];
  motion: Scene["motion"];
  transition: Scene["transition"];
  image: { moment: string; environment: string; lighting: string };
  video: { start: string; movement: string; end: string; lighting: string };
  audio: {
    dialogue: MockLine[];
    voiceOver: MockLine[];
    music: Scene["music"];
    sfx: Scene["sfx"];
  };
  negative: string[];
}

export type MockCharacter = Omit<Character, "id" | "personality" | "emotionalArc"> & {
  personality: L;
  emotionalArc: L;
};

export interface MockPreset {
  key: string;
  keywords: string[];
  title: L;
  logline: L;
  synopsis: L;
  tone: L;
  targetEmotion: L;
  characters: MockCharacter[];
  visualBible: VisualBible;
  /** Exactly 4 beats: setup, development, climax, resolution. */
  beats: [Beat, Beat, Beat, Beat];
}
