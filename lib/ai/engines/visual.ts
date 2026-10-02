import "server-only";
import { VisualEngineOutputSchema } from "@/lib/schemas/engines";
import { visualPrompt } from "@/prompts/visual";
import type { AIProvider } from "../provider";
import type { VisualInput, VisualOutput } from "./types";

/** VISUAL ENGINE — the locked Visual Bible shared by every shot. */
export async function runVisualEngine(
  provider: AIProvider,
  data: VisualInput,
  signal?: AbortSignal,
): Promise<VisualOutput> {
  return provider.generateStructured({
    task: "visual",
    schemaName: "visual_bible",
    schema: VisualEngineOutputSchema,
    input: data,
    signal,
    ...visualPrompt(data),
  });
}
