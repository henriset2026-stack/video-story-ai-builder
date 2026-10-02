import "server-only";
import { AppError } from "@/lib/errors";
import { HttpProvider, type RawStructuredCall, type RawTextCall } from "./base";

// Anthropic Messages API. Structured output uses a single forced tool whose input_schema is the
// engine's JSON Schema, so the model must return arguments matching that shape.

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

interface ContentBlock {
  type: string;
  text?: string;
  input?: unknown;
  name?: string;
}
interface MessagesResponse {
  content?: ContentBlock[];
  stop_reason?: string;
}

export class AnthropicProvider extends HttpProvider {
  readonly name = "anthropic";

  private headers() {
    return { "x-api-key": this.apiKey, "anthropic-version": API_VERSION };
  }

  protected async callText(call: RawTextCall): Promise<string> {
    const data = (await this.postJson(
      API_URL,
      this.headers(),
      {
        model: this.model,
        max_tokens: call.maxTokens,
        system: call.system,
        messages: [{ role: "user", content: call.prompt }],
        ...(call.temperature !== undefined ? { temperature: call.temperature } : {}),
      },
      call.signal,
    )) as MessagesResponse;
    return (data.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
  }

  protected async callStructured(call: RawStructuredCall): Promise<unknown> {
    const data = (await this.postJson(
      API_URL,
      this.headers(),
      {
        model: this.model,
        max_tokens: call.maxTokens,
        system: call.system,
        messages: [{ role: "user", content: call.prompt }],
        tools: [
          {
            name: call.schemaName,
            description: "Submit the final structured result. Call this exactly once.",
            input_schema: call.jsonSchema,
          },
        ],
        tool_choice: { type: "tool", name: call.schemaName },
      },
      call.signal,
    )) as MessagesResponse;

    if (data.stop_reason === "max_tokens") {
      throw new AppError("AI_INVALID_RESPONSE", { detail: "anthropic: output truncated (max_tokens)" });
    }
    const toolUse = data.content?.find((b) => b.type === "tool_use" && b.name === call.schemaName);
    if (!toolUse) throw new AppError("AI_INVALID_RESPONSE", { detail: "anthropic: no tool_use block" });
    return toolUse.input;
  }
}
