import "server-only";
import { AppError } from "@/lib/errors";
import { extractJson, HttpProvider, type RawStructuredCall, type RawTextCall } from "./base";

// OpenAI Chat Completions API with JSON Schema response format (non-strict, because strict mode
// requires every property to be required; Zod validation afterwards is the real gate).

const API_URL = "https://api.openai.com/v1/chat/completions";

interface ChatResponse {
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
}

export class OpenAIProvider extends HttpProvider {
  readonly name = "openai";

  private headers() {
    return { authorization: `Bearer ${this.apiKey}` };
  }

  private async chat(body: Record<string, unknown>, signal: AbortSignal): Promise<string> {
    const data = (await this.postJson(API_URL, this.headers(), body, signal)) as ChatResponse;
    const choice = data.choices?.[0];
    if (choice?.finish_reason === "length") {
      throw new AppError("AI_INVALID_RESPONSE", { detail: "openai: output truncated (length)" });
    }
    if (choice?.message?.refusal) throw new AppError("AI_FAILED", { detail: "openai: refusal" });
    const content = choice?.message?.content;
    if (!content) throw new AppError("AI_INVALID_RESPONSE", { detail: "openai: empty content" });
    return content;
  }

  protected callText(call: RawTextCall): Promise<string> {
    return this.chat(
      {
        model: this.model,
        max_completion_tokens: call.maxTokens,
        messages: [
          { role: "system", content: call.system },
          { role: "user", content: call.prompt },
        ],
        ...(call.temperature !== undefined ? { temperature: call.temperature } : {}),
      },
      call.signal,
    );
  }

  protected async callStructured(call: RawStructuredCall): Promise<unknown> {
    const content = await this.chat(
      {
        model: this.model,
        max_completion_tokens: call.maxTokens,
        messages: [
          { role: "system", content: call.system },
          { role: "user", content: call.prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: call.schemaName, schema: call.jsonSchema, strict: false },
        },
      },
      call.signal,
    );
    return extractJson(content);
  }
}
