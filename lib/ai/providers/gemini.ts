import "server-only";
import { AppError } from "@/lib/errors";
import { extractJson, HttpProvider, type RawStructuredCall, type RawTextCall } from "./base";

// Google Gemini generateContent API. Structured output uses responseMimeType=application/json with
// responseJsonSchema. The API key travels in a header, never in the URL (so it cannot leak into logs).

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface GenerateContentResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

export class GeminiProvider extends HttpProvider {
  readonly name = "gemini";

  private async generate(body: Record<string, unknown>, signal: AbortSignal): Promise<string> {
    const url = `${API_BASE}/${encodeURIComponent(this.model)}:generateContent`;
    const data = (await this.postJson(url, { "x-goog-api-key": this.apiKey }, body, signal)) as GenerateContentResponse;
    if (data.promptFeedback?.blockReason) {
      throw new AppError("AI_FAILED", { detail: `gemini: blocked (${data.promptFeedback.blockReason})` });
    }
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason === "MAX_TOKENS") {
      throw new AppError("AI_INVALID_RESPONSE", { detail: "gemini: output truncated (MAX_TOKENS)" });
    }
    const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    if (!text) throw new AppError("AI_INVALID_RESPONSE", { detail: "gemini: empty content" });
    return text;
  }

  protected callText(call: RawTextCall): Promise<string> {
    return this.generate(
      {
        systemInstruction: { parts: [{ text: call.system }] },
        contents: [{ role: "user", parts: [{ text: call.prompt }] }],
        generationConfig: {
          maxOutputTokens: call.maxTokens,
          ...(call.temperature !== undefined ? { temperature: call.temperature } : {}),
        },
      },
      call.signal,
    );
  }

  protected async callStructured(call: RawStructuredCall): Promise<unknown> {
    const text = await this.generate(
      {
        systemInstruction: { parts: [{ text: call.system }] },
        contents: [{ role: "user", parts: [{ text: call.prompt }] }],
        generationConfig: {
          maxOutputTokens: call.maxTokens,
          responseMimeType: "application/json",
          responseJsonSchema: call.jsonSchema,
        },
      },
      call.signal,
    );
    return extractJson(text);
  }
}
