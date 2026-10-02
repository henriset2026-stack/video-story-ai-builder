import { z } from "zod";
import {
  ASPECT_RATIOS,
  DEFAULT_SETTINGS,
  DURATIONS,
  GENRES,
  INSTRUCTION_MAX_LENGTH,
  LANGUAGES,
  MAX_SCENES,
  MIN_SCENES,
  MIN_SECONDS_PER_SCENE,
  THEME_MAX_LENGTH,
  THEME_MIN_LENGTH,
} from "@/lib/constants";
import { StoryboardSchema } from "./storyboard";

// API input schemas. Shared by route handlers (authoritative) and the create form (fast feedback).

export const GenerationInputSchema = z
  .object({
    theme: z
      .string({ error: "Please describe your video idea." })
      .trim()
      .min(THEME_MIN_LENGTH, `Please describe your video idea (at least ${THEME_MIN_LENGTH} characters).`)
      .max(THEME_MAX_LENGTH, `Please keep your idea under ${THEME_MAX_LENGTH} characters.`),
    genre: z.enum(GENRES).default(DEFAULT_SETTINGS.genre),
    duration: z
      .number()
      .int()
      .refine((v) => (DURATIONS as readonly number[]).includes(v), "Choose a supported duration.")
      .default(DEFAULT_SETTINGS.duration),
    aspectRatio: z.enum(ASPECT_RATIOS).default(DEFAULT_SETTINGS.aspectRatio),
    language: z.enum(LANGUAGES).default(DEFAULT_SETTINGS.language),
    sceneCount: z.number().int().min(MIN_SCENES).max(MAX_SCENES).default(DEFAULT_SETTINGS.sceneCount),
  })
  .refine((v) => v.duration / v.sceneCount >= MIN_SECONDS_PER_SCENE, {
    message: `Each scene needs at least ${MIN_SECONDS_PER_SCENE} seconds. Choose fewer scenes or a longer duration.`,
    path: ["sceneCount"],
  });

export const RegenerateSceneInputSchema = z.object({
  instruction: z
    .string()
    .trim()
    .max(INSTRUCTION_MAX_LENGTH, `Please keep the instruction under ${INSTRUCTION_MAX_LENGTH} characters.`)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

/** Body of POST /api/projects — save an already generated storyboard (e.g. retry after a DB failure). */
export const SaveProjectInputSchema = z.object({
  storyboard: StoryboardSchema,
});

export const UuidParamSchema = z.uuid();
