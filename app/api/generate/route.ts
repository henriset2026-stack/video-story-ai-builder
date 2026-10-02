import { getAIProvider } from "@/lib/ai";
import { generateStoryboard } from "@/lib/ai/orchestrator";
import { getRepository } from "@/lib/db/repository";
import { ERROR_CODES, logError, toAppError } from "@/lib/errors";
import { enforceRateLimit, errorResponse, generationLimiter, parseBody } from "@/lib/http";
import { GenerationInputSchema } from "@/lib/schemas/input";
import type { GenerationEvent } from "@/types";

// POST /api/generate — runs the AI pipeline and streams real progress as NDJSON:
//   {"type":"progress","step":"story","status":"running"}
//   ...
//   {"type":"result","projectId":"…","storyboard":{…}}   or   {"type":"error","code":"…","message":"…"}
// The storyboard is auto-saved. If saving fails, the result still carries the storyboard plus
// `saveError`, so the client can offer "Save project" (POST /api/projects) without regenerating.

export const maxDuration = 300;

export async function POST(request: Request) {
  let input;
  try {
    await enforceRateLimit(generationLimiter, request);
    input = await parseBody(request, GenerationInputSchema);
  } catch (error) {
    return errorResponse(error, "generate");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: GenerationEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false; // client disconnected
        }
      };

      try {
        const storyboard = await generateStoryboard(getAIProvider(), input, {
          signal: request.signal,
          onProgress: (step, status) => send({ type: "progress", step, status }),
        });

        try {
          const saved = await getRepository().createProject(storyboard);
          send({ type: "result", projectId: saved.id, storyboard: saved.storyboard });
        } catch (error) {
          logError("generate/save", toAppError(error));
          send({ type: "result", projectId: null, storyboard, saveError: ERROR_CODES.DB_FAILED.message });
        }
      } catch (error) {
        const appError = toAppError(error);
        logError("generate", appError);
        send({ type: "error", code: appError.code, message: appError.userMessage });
      } finally {
        if (open) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
