import type { z } from "zod";
import { AppError } from "@/lib/errors";
import type { GenerationInput } from "@/types";
import type { AudioInput, PromptsInput, RegenerateSceneInput, ScenesInput } from "../engines/types";
import type { AIProvider, AITask, GenerateStructuredRequest, GenerateTextRequest } from "../provider";
import {
  mockAudio,
  mockCharacters,
  mockImagePrompts,
  mockRegenerateScene,
  mockScenes,
  mockStory,
  mockVideoPrompts,
  mockVisual,
} from "./build";

// Deterministic provider for development and tests. It honours the same contract as real providers:
// output is validated against the engine's schema, so a broken fixture fails loudly instead of silently.

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

export class MockProvider implements AIProvider {
  readonly name = "mock";
  readonly model = "mock-deterministic";

  constructor(private readonly latencyMs = 0) {}

  async generateText(request: GenerateTextRequest): Promise<string> {
    await sleep(this.latencyMs, request.signal);
    return `Mock response for ${request.task}.`;
  }

  async generateStructured<T extends z.ZodType>(request: GenerateStructuredRequest<T>): Promise<z.output<T>> {
    await sleep(this.latencyMs, request.signal);
    const raw = this.build(request.task, request.input);
    const parsed = request.schema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError("AI_INVALID_RESPONSE", {
        cause: parsed.error,
        detail: `mock/${request.task}: fixture failed schema validation`,
      });
    }
    return parsed.data;
  }

  private build(task: AITask, input: unknown): unknown {
    switch (task) {
      case "story":
        return mockStory(input as GenerationInput);
      case "characters":
        return mockCharacters((input as { input: GenerationInput }).input);
      case "visual":
        return mockVisual((input as { input: GenerationInput }).input);
      case "scenes":
        return mockScenes(input as ScenesInput);
      case "imagePrompts":
        return mockImagePrompts(input as PromptsInput);
      case "videoPrompts":
        return mockVideoPrompts(input as PromptsInput);
      case "audio":
        return mockAudio(input as AudioInput);
      case "continuity":
        return { issues: [] };
      case "regenerateScene":
        return { scene: mockRegenerateScene(input as RegenerateSceneInput) };
    }
  }
}
