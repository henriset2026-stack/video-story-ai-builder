// Shared, client-safe constants. No secrets, no server imports.

export const GENRES = [
  "Cinematic",
  "Drama",
  "Documentary",
  "Commercial",
  "Inspirational",
  "Mystery / Horror",
  "Sci-Fi",
  "Comedy",
] as const;
export type Genre = (typeof GENRES)[number];

export const DURATIONS = [15, 30, 45, 60, 90] as const;
export type Duration = (typeof DURATIONS)[number];

export const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:5", "2.39:1"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const ASPECT_RATIO_LABELS: Record<AspectRatio, string> = {
  "16:9": "16:9 · Landscape",
  "9:16": "9:16 · Vertical",
  "1:1": "1:1 · Square",
  "4:5": "4:5 · Portrait",
  "2.39:1": "2.39:1 · Anamorphic",
};

export const LANGUAGES = ["Indonesian", "English"] as const;
export type Language = (typeof LANGUAGES)[number];

export const MIN_SCENES = 1;
export const MAX_SCENES = 8;
export const MIN_SECONDS_PER_SCENE = 3;

export const THEME_MIN_LENGTH = 10;
export const THEME_MAX_LENGTH = 1000;
export const INSTRUCTION_MAX_LENGTH = 500;

export const DEFAULT_SETTINGS = {
  genre: "Cinematic",
  duration: 30,
  aspectRatio: "16:9",
  language: "Indonesian",
  sceneCount: 3,
} as const satisfies {
  genre: Genre;
  duration: Duration;
  aspectRatio: AspectRatio;
  language: Language;
  sceneCount: number;
};

export const TRANSITION_TYPES = [
  "Cut",
  "Dissolve",
  "Fade",
  "Fade to Black",
  "Match Cut",
  "Sound Bridge",
  "Object Transition",
  "Whip Transition",
  "Smash Cut",
  "J-Cut",
  "L-Cut",
] as const;

export const AUDIO_MODES = ["dialogue", "voice_over", "mixed", "silence"] as const;

export const MUSIC_INTENSITIES = ["low", "medium", "high", "peak"] as const;

export const CONTINUITY_CATEGORIES = [
  "Character",
  "Face",
  "Hair",
  "Clothing",
  "Accessories",
  "Props",
  "Location",
  "Time",
  "Lighting",
  "Weather",
  "Camera",
  "Narrative",
  "Emotion",
  "Audio",
] as const;
export type ContinuityCategory = (typeof CONTINUITY_CATEGORIES)[number];

export const CONTINUITY_GROUPS = {
  character: ["Character", "Face", "Hair", "Clothing", "Accessories"],
  visual: ["Props", "Location", "Time", "Lighting", "Weather", "Camera"],
  narrative: ["Narrative", "Emotion"],
  audio: ["Audio"],
} as const satisfies Record<string, readonly ContinuityCategory[]>;
export type ContinuityGroup = keyof typeof CONTINUITY_GROUPS;

export const CONTINUITY_GROUP_LABELS: Record<ContinuityGroup, string> = {
  character: "Character consistency",
  visual: "Visual consistency",
  narrative: "Narrative continuity",
  audio: "Audio consistency",
};

/** The 9 user-visible pipeline steps. Order matters: it is the order the orchestrator reports. */
export const GENERATION_STEPS = [
  { id: "understand", label: "Understanding your idea" },
  { id: "story", label: "Developing the story" },
  { id: "characters", label: "Creating characters" },
  { id: "visual", label: "Designing the visual world" },
  { id: "scenes", label: "Building scenes" },
  { id: "imagePrompts", label: "Creating image prompts" },
  { id: "videoPrompts", label: "Creating video prompts" },
  { id: "audio", label: "Creating audio direction" },
  { id: "continuity", label: "Checking continuity" },
] as const;
export type GenerationStepId = (typeof GENERATION_STEPS)[number]["id"];

/** Base negative prompt from the product spec. Scene engines may append scene-specific terms. */
export const BASE_NEGATIVE_PROMPT_TERMS = [
  "distorted anatomy",
  "extra fingers",
  "missing fingers",
  "deformed hands",
  "deformed face",
  "duplicate people",
  "duplicate objects",
  "warped objects",
  "floating objects",
  "unnatural physics",
  "teleporting objects",
  "flickering",
  "unstable background",
  "inconsistent character",
  "inconsistent clothes",
  "inconsistent lighting",
  "artificial skin",
  "text artifacts",
  "watermark",
] as const;

export const EXAMPLE_THEMES = [
  "Seorang anak menemukan surat lama ayahnya.",
  "UMKM Indonesia berubah menjadi bisnis berbasis AI.",
  "Nelayan menyelamatkan anak di tengah badai.",
  "Kota Indonesia pada tahun 2045.",
  "Iklan cinematic kopi lokal Indonesia.",
  "Robot AI membantu petani Indonesia.",
  "Transformasi digital sebuah perusahaan.",
  "Rumah kosong misterius di sebuah desa.",
] as const;
