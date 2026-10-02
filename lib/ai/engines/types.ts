import type { z } from "zod";
import type {
  AudioEngineOutputSchema,
  CharacterEngineOutputSchema,
  ContinuityReviewOutputSchema,
  ImagePromptEngineOutputSchema,
  RegeneratedSceneSchema,
  SceneDetailSchema,
  StoryEngineOutputSchema,
  VideoPromptEngineOutputSchema,
  VisualEngineOutputSchema,
} from "@/lib/schemas/engines";
import type { Character, GenerationInput, Storyboard, VisualBible } from "@/types";

// Engine input/output types. Inputs are plain data so engines stay independent and testable.

export type StoryOutput = z.infer<typeof StoryEngineOutputSchema>;
export type CharactersOutput = z.infer<typeof CharacterEngineOutputSchema>;
export type VisualOutput = z.infer<typeof VisualEngineOutputSchema>;
export type SceneDetail = z.infer<typeof SceneDetailSchema>;
export type ImagePromptsOutput = z.infer<typeof ImagePromptEngineOutputSchema>;
export type VideoPromptsOutput = z.infer<typeof VideoPromptEngineOutputSchema>;
export type AudioOutput = z.infer<typeof AudioEngineOutputSchema>;
export type ContinuityReviewOutput = z.infer<typeof ContinuityReviewOutputSchema>;
export type RegeneratedScene = z.infer<typeof RegeneratedSceneSchema>;

export interface CharactersInput {
  input: GenerationInput;
  story: StoryOutput;
}

export interface VisualInput {
  input: GenerationInput;
  story: StoryOutput;
  characters: Character[];
}

export interface ScenesInput {
  input: GenerationInput;
  story: StoryOutput;
  characters: Character[];
  visualBible: VisualBible;
  /** Seconds per scene, fixed by the orchestrator so the total always matches the requested duration. */
  durations: number[];
}

export interface PromptsInput {
  input: GenerationInput;
  characters: Character[];
  visualBible: VisualBible;
  scenes: SceneDetail[];
}

export interface AudioInput {
  input: GenerationInput;
  story: StoryOutput;
  characters: Character[];
  scenes: SceneDetail[];
}

export interface ContinuityReviewInput {
  storyboard: Storyboard;
}

export interface RegenerateSceneInput {
  storyboard: Storyboard;
  sceneNumber: number;
  instruction?: string;
}
