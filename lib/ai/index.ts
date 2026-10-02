import "server-only";
import { getConfig } from "@/lib/config";
import { MockProvider } from "./mock/provider";
import type { AIProvider } from "./provider";
import { AnthropicProvider } from "./providers/anthropic";
import { GeminiProvider } from "./providers/gemini";
import { OpenAIProvider } from "./providers/openai";

// The only place that maps configuration to a concrete provider.

export function getAIProvider(): AIProvider {
  const { ai } = getConfig();
  if (ai.mock || !ai.apiKey) return new MockProvider(ai.mockLatencyMs);

  const options = { apiKey: ai.apiKey, model: ai.model, timeoutMs: ai.timeoutMs };
  switch (ai.provider) {
    case "anthropic":
      return new AnthropicProvider(options);
    case "openai":
      return new OpenAIProvider(options);
    case "gemini":
      return new GeminiProvider(options);
  }
}

export type { AIProvider } from "./provider";
