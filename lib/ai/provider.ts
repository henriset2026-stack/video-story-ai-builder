import type { z } from "zod";

// Provider-neutral AI contract. Engines depend only on this file — never on a vendor API.

/** Identifies which engine is calling. Used for logging and by the mock provider to pick fixtures. */
export type AITask =
  | "story"
  | "characters"
  | "visual"
  | "scenes"
  | "imagePrompts"
  | "videoPrompts"
  | "audio"
  | "continuity"
  | "regenerateScene";

export interface GenerateTextRequest {
  task: AITask;
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface GenerateStructuredRequest<T extends z.ZodType> extends GenerateTextRequest {
  /** Name for the structured output (tool / schema name). Letters, digits and underscores only. */
  schemaName: string;
  schema: T;
  /**
   * Structured copy of the engine input. Real providers ignore it (they read `prompt`);
   * the mock provider uses it to build deterministic output without parsing prose.
   */
  input: unknown;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generateText(request: GenerateTextRequest): Promise<string>;
  /** Returns output that has already passed `schema` validation. */
  generateStructured<T extends z.ZodType>(request: GenerateStructuredRequest<T>): Promise<z.output<T>>;
}
