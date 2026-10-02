import type { Language } from "@/lib/constants";
import { beatFor } from "@/prompts/shared";
import type { Character, GenerationInput, Scene, SpokenLine, VisualBible } from "@/types";
import type {
  AudioOutput,
  CharactersOutput,
  ImagePromptsOutput,
  PromptsInput,
  RegeneratedScene,
  RegenerateSceneInput,
  SceneDetail,
  ScenesInput,
  StoryOutput,
  VideoPromptsOutput,
  VisualOutput,
} from "../engines/types";
import { FALLBACK_PRESET, PRESETS } from "./presets";
import type { Beat, L, MockPreset } from "./types";

// Deterministic mock builders. They compose schema-valid engine outputs from themed presets so the
// full pipeline (progress, continuity, persistence, UI) runs without an AI provider.

const WORDS_PER_SECOND_BUDGET = 2.5;

export function t(value: L, language: Language): string {
  return language === "Indonesian" ? value.id : value.en;
}

/** Picks the preset whose keywords best match the theme. Ties resolve by preset order. */
export function selectPreset(theme: string): MockPreset {
  const text = theme.toLowerCase();
  let best: MockPreset = FALLBACK_PRESET;
  let bestScore = 0;
  for (const preset of PRESETS) {
    const score = preset.keywords.reduce((n, k) => n + (text.includes(k) ? 1 : 0), 0);
    if (score > bestScore) {
      best = preset;
      bestScore = score;
    }
  }
  return best;
}

/** Maps N scenes onto the preset's 4 beats (setup, development, climax, resolution). */
export function beatIndexes(count: number): number[] {
  if (count === 1) return [3];
  if (count === 2) return [0, 3];
  if (count === 3) return [0, 2, 3];
  const middle = Array.from({ length: count - 3 }, () => 1);
  return [0, ...middle, 2, 3];
}

function beatsFor(preset: MockPreset, count: number): { beat: Beat; variant: number }[] {
  const seen = new Map<number, number>();
  return beatIndexes(count).map((i) => {
    const variant = seen.get(i) ?? 0;
    seen.set(i, variant + 1);
    return { beat: preset.beats[i], variant };
  });
}

const VARIANT_LENSES = ["35mm", "50mm", "85mm", "24mm"];

function sceneTitle(beat: Beat, variant: number, language: Language): string {
  const base = t(beat.title, language);
  return variant === 0 ? base : `${base} (${variant + 1})`;
}

function characterSentence(c: Character): string {
  return `${c.name}, a ${c.age}-year-old ${c.nationality} ${c.gender} with ${c.hair}, ${c.face}, wearing ${c.clothing}${
    c.accessories.toLowerCase() === "none" ? "" : `, ${c.accessories}`
  }`;
}

function castFor(names: string[], characters: Character[]): Character[] {
  return names.map((n) => characters.find((c) => c.name === n)).filter((c): c is Character => Boolean(c));
}

// ---- Engine builders -------------------------------------------------------------------------

export function mockStory(input: GenerationInput): StoryOutput {
  const preset = selectPreset(input.theme);
  const lang = input.language;
  const beats = beatsFor(preset, input.sceneCount);
  // The fallback preset quotes the user's idea; keep it short so the text stays within schema limits.
  const theme = input.theme.length > 120 ? `${input.theme.slice(0, 117)}...` : input.theme;
  const withTheme = (value: L) => t(value, lang).replaceAll("{theme}", theme);
  return {
    title: t(preset.title, lang),
    logline: withTheme(preset.logline),
    synopsis: withTheme(preset.synopsis),
    tone: t(preset.tone, lang),
    targetEmotion: t(preset.targetEmotion, lang),
    characterSeeds: preset.characters.map((c) => ({ name: c.name, role: c.role, summary: t(c.personality, lang) })),
    outline: beats.map(({ beat, variant }, i) => ({
      sceneNumber: i + 1,
      beat: beatFor(i, input.sceneCount),
      summary: t(beat.action, lang),
      location: beat.location,
      timeOfDay: beat.timeOfDay,
      emotionalBeat: t(beat.emotionalBeat, lang) + (variant ? ` (${variant + 1})` : ""),
    })),
  };
}

export function mockCharacters(input: GenerationInput): CharactersOutput {
  const preset = selectPreset(input.theme);
  return {
    characters: preset.characters.map((c, i) => ({
      ...c,
      id: `char-${i + 1}`,
      personality: t(c.personality, input.language),
      emotionalArc: t(c.emotionalArc, input.language),
    })),
  };
}

export function mockVisual(input: GenerationInput): VisualOutput {
  return { visualBible: selectPreset(input.theme).visualBible };
}

export function mockScenes({ input, durations }: ScenesInput): { scenes: SceneDetail[] } {
  const preset = selectPreset(input.theme);
  const lang = input.language;
  const beats = beatsFor(preset, input.sceneCount);
  return {
    scenes: beats.map(({ beat, variant }, i) => ({
      sceneNumber: i + 1,
      title: sceneTitle(beat, variant, lang),
      duration: durations[i],
      location: beat.location,
      timeOfDay: beat.timeOfDay,
      purpose: t(beat.purpose, lang),
      emotionalBeat: t(beat.emotionalBeat, lang),
      characters: beat.characters,
      action: t(beat.action, lang),
      camera: variant ? { ...beat.camera, lens: VARIANT_LENSES[variant % VARIANT_LENSES.length] } : beat.camera,
      motion: beat.motion,
      transition:
        i === beats.length - 1
          ? { type: "Fade to Black", description: "The final frame fades slowly to black as the music resolves." }
          : beat.transition,
    })),
  };
}

function beatForScene(input: GenerationInput, sceneNumber: number): Beat {
  const preset = selectPreset(input.theme);
  return beatsFor(preset, input.sceneCount)[sceneNumber - 1].beat;
}

export function composeImagePrompt(
  scene: SceneDetail,
  beat: Beat,
  characters: Character[],
  vb: VisualBible,
  aspectRatio: string,
  note?: string,
): string {
  const cast = castFor(scene.characters, characters);
  const who = cast.length ? ` of ${cast.map(characterSentence).join(", and ")}` : "";
  return [
    `${scene.camera.shot}, ${scene.camera.angle}${who}.`,
    beat.image.moment,
    beat.image.environment,
    `${beat.image.lighting}${note ? `, ${note}` : ""}.`,
    `Atmosphere: ${vb.atmosphere}.`,
    `Composition: ${scene.camera.framing}, composed for ${aspectRatio}.`,
    `Shot on a ${scene.camera.lens} lens, ${vb.depthOfField}.`,
    `Color grading: ${vb.colorPalette.join(", ")}.`,
    `${vb.realism}, aspect ratio ${aspectRatio}.`,
  ].join(" ");
}

export function composeVideoPrompt(scene: SceneDetail, beat: Beat, characters: Character[], note?: string): string {
  const cast = castFor(scene.characters, characters);
  return [
    `Starting state: ${beat.video.start} ${scene.camera.shot} from a ${scene.camera.angle.toLowerCase()} on a ${scene.camera.lens} lens.`,
    cast.length ? `On screen: ${cast.map(characterSentence).join("; ")}.` : "",
    `Character movement: ${scene.motion.subjectMovement}.`,
    beat.video.movement,
    `Environment: ${scene.motion.environmentMovement}.`,
    `Camera: ${scene.camera.movement}; focus: ${scene.camera.focus}.`,
    `Lighting: ${beat.video.lighting}${note ? `, ${note}` : ""}.`,
    `Realistic physics: natural body weight and inertia, fabric and hair react to movement and air, particles and liquids obey gravity.`,
    `Ending state: ${beat.video.end}`,
    `Transition: ${scene.transition.type} — ${scene.transition.description}`,
    `No on-screen text, no subtitles, no logos. ${scene.duration} seconds, one continuous shot.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function mockImagePrompts({ input, characters, visualBible, scenes }: PromptsInput): ImagePromptsOutput {
  return {
    scenes: scenes.map((scene) => {
      const beat = beatForScene(input, scene.sceneNumber);
      return {
        sceneNumber: scene.sceneNumber,
        imagePrompt: composeImagePrompt(scene, beat, characters, visualBible, input.aspectRatio),
        negativeAdditions: beat.negative,
      };
    }),
  };
}

export function mockVideoPrompts({ input, characters, scenes }: PromptsInput): VideoPromptsOutput {
  return {
    scenes: scenes.map((scene) => ({
      sceneNumber: scene.sceneNumber,
      videoPrompt: composeVideoPrompt(scene, beatForScene(input, scene.sceneNumber), characters),
    })),
  };
}

/** Keeps whole lines while they fit the scene's word budget, so audio always fits the duration. */
function fitLines(lines: Beat["audio"]["dialogue"], budget: number, language: Language): { lines: SpokenLine[]; used: number } {
  const result: SpokenLine[] = [];
  let used = 0;
  for (const line of lines) {
    const text = t(line.text, language);
    const words = text.split(/\s+/).length;
    if (used + words > budget) break;
    result.push({ ...line, text });
    used += words;
  }
  return { lines: result, used };
}

function audioFor(beat: Beat, duration: number, language: Language) {
  const budget = Math.floor(duration * WORDS_PER_SECOND_BUDGET);
  const dialogue = fitLines(beat.audio.dialogue, budget, language);
  const voiceOver = fitLines(beat.audio.voiceOver, budget - dialogue.used, language);
  const d = dialogue.lines.length > 0;
  const v = voiceOver.lines.length > 0;
  const audioMode = d && v ? "mixed" : d ? "dialogue" : v ? "voice_over" : "silence";
  return { audioMode, dialogue: dialogue.lines, voiceOver: voiceOver.lines, music: beat.audio.music, sfx: beat.audio.sfx } as const;
}

export function mockAudio({ input, scenes }: { input: GenerationInput; scenes: SceneDetail[] }): AudioOutput {
  return {
    scenes: scenes.map((scene) => ({
      sceneNumber: scene.sceneNumber,
      ...audioFor(beatForScene(input, scene.sceneNumber), scene.duration, input.language),
    })),
  };
}

const NOTE_MARKERS = [" Catatan sutradara diterapkan:", " Director's note applied:"];

/** Deterministic "regeneration": same beat, with the instruction applied as a director's note. */
export function mockRegenerateScene({ storyboard, sceneNumber, instruction }: RegenerateSceneInput): RegeneratedScene {
  const p = storyboard.project;
  const input: GenerationInput = {
    theme: p.theme,
    genre: p.genre,
    duration: p.duration,
    aspectRatio: p.aspectRatio,
    language: p.language,
    sceneCount: storyboard.scenes.length,
  };
  const current = storyboard.scenes.find((s) => s.sceneNumber === sceneNumber) as Scene;
  const beat = beatForScene(input, sceneNumber);
  const note = instruction?.trim().slice(0, 160);
  const baseAction = NOTE_MARKERS.reduce((a, m) => a.split(m)[0], current.action);
  const directorNote = note ? `${p.language === "Indonesian" ? NOTE_MARKERS[0] : NOTE_MARKERS[1]} ${note}` : "";
  const baseMovement = beat.camera.movement;

  const detail: SceneDetail = {
    sceneNumber,
    title: current.title,
    duration: current.duration,
    location: current.location,
    timeOfDay: current.timeOfDay,
    purpose: current.purpose,
    emotionalBeat: current.emotionalBeat,
    characters: current.characters.filter((n) => storyboard.characters.some((c) => c.name === n)),
    action: `${baseAction}${directorNote}`,
    camera: { ...current.camera, movement: note ? `${baseMovement}, adjusted to the note` : `${baseMovement}, slightly slower and more deliberate` },
    motion: current.motion,
    transition: current.transition,
  };
  const englishNote = note ? `adjusted to the director's note "${note}"` : undefined;
  return {
    ...detail,
    imagePrompt: composeImagePrompt(detail, beat, storyboard.characters, storyboard.visualBible, p.aspectRatio, englishNote),
    videoPrompt: composeVideoPrompt(detail, beat, storyboard.characters, englishNote),
    ...audioFor(beat, current.duration, p.language),
    negativeAdditions: beat.negative,
  };
}
