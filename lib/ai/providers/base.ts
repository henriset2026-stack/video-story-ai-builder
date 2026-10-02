import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { AIProvider, GenerateStructuredRequest, GenerateTextRequest } from "../provider";

// Shared behaviour for HTTP-based providers: timeouts, error mapping, JSON Schema conversion,
// Zod validation and a single repair retry. Subclasses only implement the vendor wire format.

export interface ProviderOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export interface RawStructuredCall {
  system: string;
  prompt: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  maxTokens: number;
  signal: AbortSignal;
}

export interface RawTextCall {
  system: string;
  prompt: string;
  maxTokens: number;
  temperature?: number;
  signal: AbortSignal;
}

const DEFAULT_STRUCTURED_MAX_TOKENS = 16_000;
const DEFAULT_TEXT_MAX_TOKENS = 4_000;
const MAX_REPAIR_ATTEMPTS = 1;

export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { unrepresentable: "any" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

/** Parses JSON from model text, tolerating code fences or prose around a single JSON object. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    const candidate = fenced ?? trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1);
    try {
      return JSON.parse(candidate);
    } catch (error) {
      throw new AppError("AI_INVALID_RESPONSE", { cause: error, detail: "Model returned non-JSON output" });
    }
  }
}

export function formatIssues(error: z.ZodError, limit = 15): string {
  return error.issues
    .slice(0, limit)
    .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

export abstract class HttpProvider implements AIProvider {
  abstract readonly name: string;
  readonly model: string;
  protected readonly apiKey: string;
  protected readonly timeoutMs: number;

  constructor(options: ProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.timeoutMs = options.timeoutMs;
  }

  protected abstract callText(call: RawTextCall): Promise<string>;
  protected abstract callStructured(call: RawStructuredCall): Promise<unknown>;

  async generateText(request: GenerateTextRequest): Promise<string> {
    return this.callText({
      system: request.system,
      prompt: request.prompt,
      maxTokens: request.maxTokens ?? DEFAULT_TEXT_MAX_TOKENS,
      temperature: request.temperature,
      signal: this.signal(request.signal),
    });
  }

  async generateStructured<T extends z.ZodType>(request: GenerateStructuredRequest<T>): Promise<z.output<T>> {
    const jsonSchema = toJsonSchema(request.schema);
    let prompt = request.prompt;
    let lastError: z.ZodError | null = null;

    for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
      const raw = await this.callStructured({
        system: request.system,
        prompt,
        schemaName: request.schemaName,
        jsonSchema,
        maxTokens: request.maxTokens ?? DEFAULT_STRUCTURED_MAX_TOKENS,
        signal: this.signal(request.signal),
      });
      const result = request.schema.safeParse(raw);
      if (result.success) return result.data;

      lastError = result.error;
      prompt =
        `${request.prompt}\n\n---\nYour previous answer failed validation:\n${formatIssues(result.error)}\n` +
        `Return the COMPLETE corrected output. Keep everything that was valid.`;
    }

    throw new AppError("AI_INVALID_RESPONSE", {
      cause: lastError,
      detail: `${this.name}/${request.task}: output failed schema validation after repair`,
    });
  }

  protected signal(external?: AbortSignal): AbortSignal {
    const timeout = AbortSignal.timeout(this.timeoutMs);
    return external ? AbortSignal.any([external, timeout]) : timeout;
  }

  /** POSTs JSON and maps transport/HTTP failures to AppErrors. Never includes the API key in errors. */
  protected async postJson(url: string, headers: Record<string, string>, body: unknown, signal: AbortSignal) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        throw new AppError("AI_TIMEOUT", { cause: error });
      }
      throw new AppError("AI_FAILED", { cause: error, detail: `${this.name}: network error` });
    }

    if (!response.ok) {
      // Read a bounded slice of the body for server logs only; vendor errors do not contain our key.
      const snippet = (await response.text().catch(() => "")).slice(0, 300);
      const detail = `${this.name}: HTTP ${response.status} ${snippet}`;
      if (response.status === 429) throw new AppError("AI_RATE_LIMITED", { detail });
      if (response.status === 408 || response.status === 504) throw new AppError("AI_TIMEOUT", { detail });
      throw new AppError("AI_FAILED", { detail });
    }

    try {
      return (await response.json()) as unknown;
    } catch (error) {
      throw new AppError("AI_INVALID_RESPONSE", { cause: error, detail: `${this.name}: invalid JSON body` });
    }
  }
}
