import "server-only";
import { BASE_NEGATIVE_PROMPT_TERMS, type GenerationStepId } from "@/lib/constants";
import { allocateDurations, type DraftStoryboard } from "@/lib/continuity/rules";
import { AppError } from "@/lib/errors";
import { StoryboardSchema } from "@/lib/schemas/storyboard";
import type { GenerationInput, Scene, StepStatus, Storyboard } from "@/types";
import { runAudioEngine } from "./engines/audio";
import { runContinuityEngine } from "./engines/continuity";
import { runImagePromptEngine, runVideoPromptEngine } from "./engines/media";
import { runRegenerateSceneEngine } from "./engines/regenerate";
import { runSceneEngine } from "./engines/scenes";
import { runCharacterEngine, runStoryEngine } from "./engines/story";
import { runVisualEngine } from "./engines/visual";
import type { AIProvider } from "./provider";

// AI ORCHESTRATOR — the only module that knows the order of the engines.
//
//   story → characters → visual → scenes → (image prompts ∥ video prompts ∥ audio) → continuity
//
// Every step reports real progress through `onProgress`.

export type ProgressCallback = (step: GenerationStepId, status: StepStatus) => void;

export interface OrchestratorOptions {
  onProgress?: ProgressCallback;
  signal?: AbortSignal;
}

export const GLOBAL_NEGATIVE_PROMPT = BASE_NEGATIVE_PROMPT_TERMS.join(", ");

export function sceneNegativePrompt(additions: string[]): string {
  const base = new Set<string>(BASE_NEGATIVE_PROMPT_TERMS);
  const extra = additions.map((a) => a.trim().toLowerCase()).filter((a) => a && !base.has(a));
  return [...BASE_NEGATIVE_PROMPT_TERMS, ...new Set(extra)].join(", ");
}

async function step<T>(id: GenerationStepId, onProgress: ProgressCallback | undefined, run: () => Promise<T>): Promise<T> {
  onProgress?.(id, "running");
  try {
    const result = await run();
    onProgress?.(id, "done");
    return result;
  } catch (error) {
    onProgress?.(id, "error");
    throw error;
  }
}

function validateFinal(storyboard: Storyboard): Storyboard {
  const parsed = StoryboardSchema.safeParse(storyboard);
  if (!parsed.success) {
    throw new AppError("AI_INVALID_RESPONSE", { cause: parsed.error, detail: "Final storyboard failed validation" });
  }
  return parsed.data;
}

function toDraft(storyboard: Storyboard): DraftStoryboard {
  return {
    project: storyboard.project,
    characters: storyboard.characters,
    visualBible: storyboard.visualBible,
    scenes: storyboard.scenes,
    globalNegativePrompt: storyboard.globalNegativePrompt,
  };
}

export async function generateStoryboard(
  provider: AIProvider,
  input: GenerationInput,
  { onProgress, signal }: OrchestratorOptions = {},
): Promise<Storyboard> {
  // 1. The input has already been validated by the route; this step fixes the plan the engines follow.
  const durations = await step("understand", onProgress, async () => allocateDurations(input.duration, input.sceneCount));

  const story = await step("story", onProgress, () => runStoryEngine(provider, input, signal));
  const { characters } = await step("characters", onProgress, () =>
    runCharacterEngine(provider, { input, story }, signal),
  );
  const { visualBible } = await step("visual", onProgress, () =>
    runVisualEngine(provider, { input, story, characters }, signal),
  );
  const details = await step("scenes", onProgress, () =>
    runSceneEngine(provider, { input, story, characters, visualBible, durations }, signal),
  );

  const promptsInput = { input, characters, visualBible, scenes: details };
  const [images, videos, audio] = await Promise.all([
    step("imagePrompts", onProgress, () => runImagePromptEngine(provider, promptsInput, signal)),
    step("videoPrompts", onProgress, () => runVideoPromptEngine(provider, promptsInput, signal)),
    step("audio", onProgress, () => runAudioEngine(provider, { input, story, characters, scenes: details }, signal)),
  ]);

  const scenes: Scene[] = details.map((d, i) => {
    const image = images.scenes[i];
    const sound = audio.scenes[i];
    return {
      ...d,
      imagePrompt: image.imagePrompt,
      videoPrompt: videos.scenes[i].videoPrompt,
      audioMode: sound.audioMode,
      dialogue: sound.dialogue,
      voiceOver: sound.voiceOver,
      music: sound.music,
      sfx: sound.sfx,
      negativePrompt: sceneNegativePrompt(image.negativeAdditions),
    };
  });

  const draft: DraftStoryboard = {
    project: {
      title: story.title,
      logline: story.logline,
      synopsis: story.synopsis,
      theme: input.theme,
      genre: input.genre,
      tone: story.tone,
      targetEmotion: story.targetEmotion,
      duration: input.duration,
      aspectRatio: input.aspectRatio,
      language: input.language,
    },
    characters,
    visualBible,
    scenes,
    globalNegativePrompt: GLOBAL_NEGATIVE_PROMPT,
  };

  const checked = await step("continuity", onProgress, () => runContinuityEngine(provider, draft, { signal }));
  return validateFinal(checked);
}

/**
 * Rewrites one scene. The Character Bible, Visual Bible and every other scene are preserved exactly;
 * continuity is re-checked with rewrites restricted to the regenerated scene.
 */
export async function regenerateScene(
  provider: AIProvider,
  storyboard: Storyboard,
  sceneNumber: number,
  instruction: string | undefined,
  signal?: AbortSignal,
): Promise<{ storyboard: Storyboard; scene: Scene }> {
  const original = storyboard.scenes.find((s) => s.sceneNumber === sceneNumber);
  if (!original) throw new AppError("NOT_FOUND", { detail: `Scene ${sceneNumber} not in storyboard` });

  const generated = await runRegenerateSceneEngine(provider, { storyboard, sceneNumber, instruction }, signal);
  const { negativeAdditions, ...fields } = generated;
  const replacement: Scene = {
    ...fields,
    id: original.id,
    sceneNumber,
    duration: original.duration,
    negativePrompt: sceneNegativePrompt(negativeAdditions),
  };

  const draft = toDraft(storyboard);
  draft.scenes = storyboard.scenes.map((s) => (s.sceneNumber === sceneNumber ? replacement : s));
  const checked = await runContinuityEngine(provider, draft, { editableScenes: [sceneNumber], signal });

  // Guarantee that only the selected scene changed, whatever the continuity pass did.
  const finalScene = checked.scenes.find((s) => s.sceneNumber === sceneNumber)!;
  const result = validateFinal({
    ...checked,
    characters: storyboard.characters,
    visualBible: storyboard.visualBible,
    scenes: storyboard.scenes.map((s) => (s.sceneNumber === sceneNumber ? finalScene : s)),
  });
  return { storyboard: result, scene: result.scenes.find((s) => s.sceneNumber === sceneNumber)! };
}
