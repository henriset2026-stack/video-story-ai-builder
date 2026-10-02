import "server-only";
import { ImagePromptEngineOutputSchema, VideoPromptEngineOutputSchema } from "@/lib/schemas/engines";
import { imagePromptsPrompt, videoPromptsPrompt } from "@/prompts/media";
import type { AIProvider } from "../provider";
import type { ImagePromptsOutput, PromptsInput, VideoPromptsOutput } from "./types";
import { exactSceneNumbers } from "./validation";

// PROMPT GENERATOR — image and video prompts are separate engines so they can run in parallel
// and so the video prompt is written for motion rather than derived from the still.

/** IMAGE PROMPT ENGINE */
export async function runImagePromptEngine(
  provider: AIProvider,
  data: PromptsInput,
  signal?: AbortSignal,
): Promise<ImagePromptsOutput> {
  const schema = ImagePromptEngineOutputSchema.superRefine((out, ctx) =>
    exactSceneNumbers(out.scenes, data.scenes.length, ctx, "scenes"),
  );
  return provider.generateStructured({
    task: "imagePrompts",
    schemaName: "image_prompts",
    schema,
    input: data,
    signal,
    ...imagePromptsPrompt(data),
  });
}

/** VIDEO PROMPT ENGINE (Google Flow / Veo) */
export async function runVideoPromptEngine(
  provider: AIProvider,
  data: PromptsInput,
  signal?: AbortSignal,
): Promise<VideoPromptsOutput> {
  const schema = VideoPromptEngineOutputSchema.superRefine((out, ctx) =>
    exactSceneNumbers(out.scenes, data.scenes.length, ctx, "scenes"),
  );
  return provider.generateStructured({
    task: "videoPrompts",
    schemaName: "video_prompts",
    schema,
    input: data,
    signal,
    ...videoPromptsPrompt(data),
  });
}
