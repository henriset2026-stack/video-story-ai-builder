import { z } from "zod";
import {
  ASPECT_RATIOS,
  AUDIO_MODES,
  CONTINUITY_CATEGORIES,
  GENRES,
  LANGUAGES,
  MUSIC_INTENSITIES,
  TRANSITION_TYPES,
} from "@/lib/constants";

// Domain schemas for the final storyboard. These are the single source of truth:
// AI engine outputs are composed from them, the DB mappers read/write them, and the UI renders them.
// Keep them transform-free so they can be converted to JSON Schema for structured AI output.

const text = (min = 1, max = 4000) => z.string().trim().min(min).max(max);

/** Image/video prompts must be substantial — a one-liner like "a cinematic scene" is a defect. */
export const PROMPT_MIN_LENGTH = 160;
const promptText = () => text(PROMPT_MIN_LENGTH, 6000);

export const CharacterSchema = z.object({
  id: text(1, 40).describe("Stable slug, e.g. 'char-1'"),
  name: text(1, 80),
  role: text(1, 120).describe("Story role, e.g. 'Protagonist', 'Mentor'"),
  age: text(1, 40).describe("Specific age or narrow range, e.g. '10' or 'early 60s'"),
  gender: text(1, 40),
  nationality: text(1, 80),
  appearance: text(10, 600).describe("Build, height, skin tone, distinctive features"),
  face: text(10, 400),
  hair: text(5, 300),
  clothing: text(10, 500).describe("Exact garments with colors and materials — locked for all scenes"),
  accessories: text(1, 300).describe("Exact accessories, or 'None'"),
  personality: text(10, 600),
  emotionalArc: text(10, 600),
});

export const VisualBibleSchema = z.object({
  visualStyle: text(10, 600),
  cinematography: text(10, 600),
  lighting: text(10, 600),
  colorPalette: z.array(text(2, 80)).min(3).max(8).describe("Named colors with hex, e.g. 'Amber #D9A15B'"),
  environment: text(10, 600),
  atmosphere: text(10, 600),
  realism: text(5, 400),
  lensLanguage: text(5, 400),
  cameraLanguage: text(5, 400),
  depthOfField: text(5, 300),
});

export const SpokenLineSchema = z.object({
  speaker: text(1, 80),
  voiceType: text(2, 120).describe("e.g. 'warm baritone', 'soft child voice'"),
  age: text(1, 40),
  emotion: text(2, 80),
  pacing: text(2, 80),
  text: text(1, 600).describe("Exact words to be spoken, in the project language"),
});

export const MusicSchema = z.object({
  genre: text(2, 120),
  mood: text(2, 160),
  bpm: z.number().int().min(40).max(200),
  instrumentation: z.array(text(2, 80)).min(1).max(8),
  intensity: z.enum(MUSIC_INTENSITIES),
  direction: text(5, 400).describe("How the music evolves inside this scene"),
});

export const SfxSchema = z.object({
  sound: text(2, 80),
  detail: text(3, 300),
  timing: text(1, 60).describe("When it occurs, e.g. '0:02–0:04' or 'continuous'"),
});

export const CameraSchema = z.object({
  shot: text(2, 120).describe("e.g. 'Medium close-up'"),
  angle: text(2, 120),
  lens: text(2, 80).describe("Focal length, e.g. '50mm'"),
  framing: text(3, 300),
  movement: text(3, 300),
  focus: text(3, 300),
});

export const MotionSchema = z.object({
  subjectMovement: text(3, 400),
  environmentMovement: text(3, 400),
});

export const TransitionSchema = z.object({
  type: z.enum(TRANSITION_TYPES),
  description: text(3, 300),
});

export const SceneSchema = z.object({
  id: z.uuid().optional().describe("Assigned when persisted"),
  sceneNumber: z.number().int().min(1).max(20),
  title: text(2, 120),
  duration: z.number().int().min(1).max(90).describe("Seconds"),
  location: text(3, 300),
  timeOfDay: text(2, 80),
  purpose: text(3, 300),
  emotionalBeat: text(3, 200),
  characters: z.array(text(1, 80)).max(6).describe("Character names from the Character Bible"),
  action: text(10, 1500),
  imagePrompt: promptText(),
  videoPrompt: promptText(),
  audioMode: z.enum(AUDIO_MODES),
  dialogue: z.array(SpokenLineSchema).max(8),
  voiceOver: z.array(SpokenLineSchema).max(6),
  music: MusicSchema,
  sfx: z.array(SfxSchema).max(10),
  camera: CameraSchema,
  motion: MotionSchema,
  transition: TransitionSchema,
  negativePrompt: text(10, 2000),
});

export const ContinuityIssueSchema = z.object({
  category: z.enum(CONTINUITY_CATEGORIES),
  sceneNumber: z.number().int().min(1).nullable(),
  severity: z.enum(["low", "medium", "high"]),
  description: text(3, 600),
  resolution: z.string().trim().max(600).nullable(),
  fixed: z.boolean(),
});

const GroupResultSchema = z.object({
  status: z.enum(["pass", "fixed", "fail"]),
  checked: z.array(z.enum(CONTINUITY_CATEGORIES)),
});

export const ContinuityCheckSchema = z.object({
  status: z.enum(["PASS", "NEEDS_REVISION"]),
  checkedAt: z.iso.datetime(),
  groups: z.object({
    character: GroupResultSchema,
    visual: GroupResultSchema,
    narrative: GroupResultSchema,
    audio: GroupResultSchema,
  }),
  issues: z.array(ContinuityIssueSchema).max(60),
});

export const ProjectMetaSchema = z.object({
  title: text(2, 120),
  logline: text(10, 500),
  synopsis: text(20, 2000),
  theme: text(1, 1000),
  genre: z.enum(GENRES),
  tone: text(2, 160),
  targetEmotion: text(2, 160),
  duration: z.number().int().min(5).max(600),
  aspectRatio: z.enum(ASPECT_RATIOS),
  language: z.enum(LANGUAGES),
});

export const StoryboardSchema = z.object({
  project: ProjectMetaSchema,
  characters: z.array(CharacterSchema).min(1).max(6),
  visualBible: VisualBibleSchema,
  scenes: z.array(SceneSchema).min(1).max(8),
  globalNegativePrompt: text(10, 3000),
  continuityCheck: ContinuityCheckSchema,
});

export const StoredProjectSchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  storyboard: StoryboardSchema,
});

export const ProjectSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  theme: z.string(),
  genre: z.string(),
  duration: z.number(),
  aspectRatio: z.string(),
  language: z.string(),
  sceneCount: z.number(),
  createdAt: z.string(),
});
