import type { z } from "zod";
import type {
  CharacterSchema,
  ContinuityCheckSchema,
  ContinuityIssueSchema,
  ProjectMetaSchema,
  ProjectSummarySchema,
  SceneSchema,
  SpokenLineSchema,
  StoredProjectSchema,
  StoryboardSchema,
  VisualBibleSchema,
} from "@/lib/schemas/storyboard";
import type { GenerationInputSchema } from "@/lib/schemas/input";
import type { GenerationStepId } from "@/lib/constants";

// TypeScript types are inferred from the Zod schemas so they can never drift apart.

export type Character = z.infer<typeof CharacterSchema>;
export type VisualBible = z.infer<typeof VisualBibleSchema>;
export type SpokenLine = z.infer<typeof SpokenLineSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type ContinuityIssue = z.infer<typeof ContinuityIssueSchema>;
export type ContinuityCheck = z.infer<typeof ContinuityCheckSchema>;
export type ProjectMeta = z.infer<typeof ProjectMetaSchema>;
export type Storyboard = z.infer<typeof StoryboardSchema>;
export type StoredProject = z.infer<typeof StoredProjectSchema>;
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;
export type GenerationInput = z.output<typeof GenerationInputSchema>;

export type StepStatus = "pending" | "running" | "done" | "error";

/** NDJSON events streamed by POST /api/generate. */
export type GenerationEvent =
  | { type: "progress"; step: GenerationStepId; status: StepStatus }
  | { type: "result"; projectId: string | null; storyboard: Storyboard; saveError?: string }
  | { type: "error"; code: string; message: string };
