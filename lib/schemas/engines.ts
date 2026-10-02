import { z } from "zod";
import { CONTINUITY_CATEGORIES } from "@/lib/constants";
import { CharacterSchema, SceneSchema, VisualBibleSchema } from "./storyboard";

// Output contracts for each AI engine. Each engine validates its own slice; the orchestrator
// assembles slices into a StoryboardSchema object and validates the whole again.

const text = (min = 1, max = 4000) => z.string().trim().min(min).max(max);

export const StoryEngineOutputSchema = z.object({
  title: text(2, 120),
  logline: text(10, 500),
  synopsis: text(20, 2000),
  tone: text(2, 160),
  targetEmotion: text(2, 160),
  characterSeeds: z
    .array(z.object({ name: text(1, 80), role: text(1, 120), summary: text(5, 400) }))
    .min(1)
    .max(4),
  outline: z
    .array(
      z.object({
        sceneNumber: z.number().int().min(1),
        beat: text(2, 80).describe("Setup, Development, Conflict, Climax, Resolution / Payoff"),
        summary: text(10, 600),
        location: text(3, 200),
        timeOfDay: text(2, 80),
        emotionalBeat: text(3, 200),
      }),
    )
    .min(1)
    .max(8),
});

export const CharacterEngineOutputSchema = z.object({
  characters: z.array(CharacterSchema).min(1).max(6),
});

export const VisualEngineOutputSchema = z.object({
  visualBible: VisualBibleSchema,
});

export const SceneDetailSchema = SceneSchema.pick({
  sceneNumber: true,
  title: true,
  duration: true,
  location: true,
  timeOfDay: true,
  purpose: true,
  emotionalBeat: true,
  characters: true,
  action: true,
  camera: true,
  motion: true,
  transition: true,
});

export const SceneEngineOutputSchema = z.object({
  scenes: z.array(SceneDetailSchema).min(1).max(8),
});

const negativeAdditions = z
  .array(text(2, 80))
  .max(8)
  .describe("Scene-specific negative terms, beyond the global list");

export const ImagePromptEngineOutputSchema = z.object({
  scenes: z
    .array(
      z.object({
        sceneNumber: z.number().int().min(1),
        imagePrompt: SceneSchema.shape.imagePrompt,
        negativeAdditions,
      }),
    )
    .min(1)
    .max(8),
});

export const VideoPromptEngineOutputSchema = z.object({
  scenes: z
    .array(z.object({ sceneNumber: z.number().int().min(1), videoPrompt: SceneSchema.shape.videoPrompt }))
    .min(1)
    .max(8),
});

export const SceneAudioSchema = SceneSchema.pick({
  sceneNumber: true,
  audioMode: true,
  dialogue: true,
  voiceOver: true,
  music: true,
  sfx: true,
});

export const AudioEngineOutputSchema = z.object({
  scenes: z.array(SceneAudioSchema).min(1).max(8),
});

/** Scene fields the continuity reviewer is allowed to rewrite. Bibles are never rewritten by the fixer. */
export const FIXABLE_SCENE_FIELDS = ["imagePrompt", "videoPrompt", "action", "location", "timeOfDay"] as const;

export const ContinuityReviewOutputSchema = z.object({
  issues: z
    .array(
      z.object({
        category: z.enum(CONTINUITY_CATEGORIES),
        sceneNumber: z.number().int().min(1).nullable(),
        severity: z.enum(["low", "medium", "high"]),
        description: text(3, 600),
        fix: z
          .object({
            field: z.enum(FIXABLE_SCENE_FIELDS),
            value: text(3, 6000).describe("The complete corrected field value, not a diff"),
          })
          .nullable(),
      }),
    )
    .max(20),
});

export const RegeneratedSceneSchema = SceneSchema.omit({ id: true, negativePrompt: true }).extend({
  negativeAdditions,
});

export const RegenerateSceneEngineOutputSchema = z.object({
  scene: RegeneratedSceneSchema,
});
