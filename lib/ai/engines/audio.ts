import "server-only";
import type { z } from "zod";
import { AudioEngineOutputSchema, type SceneAudioSchema } from "@/lib/schemas/engines";
import { audioPrompt } from "@/prompts/audio";
import type { AIProvider } from "../provider";
import type { AudioInput, AudioOutput } from "./types";
import { exactSceneNumbers } from "./validation";

/** Returns a message when audioMode contradicts the spoken lines, otherwise null. */
export function audioModeProblem(scene: z.infer<typeof SceneAudioSchema>): string | null {
  const d = scene.dialogue.length > 0;
  const v = scene.voiceOver.length > 0;
  switch (scene.audioMode) {
    case "silence":
      return d || v ? "audioMode 'silence' requires empty dialogue and voiceOver" : null;
    case "dialogue":
      return !d || v ? "audioMode 'dialogue' requires dialogue lines and no voiceOver" : null;
    case "voice_over":
      return d || !v ? "audioMode 'voice_over' requires voiceOver lines and no dialogue" : null;
    case "mixed":
      return !d || !v ? "audioMode 'mixed' requires both dialogue and voiceOver lines" : null;
  }
}

/** AUDIO ENGINE — dialogue / voice-over, music and SFX per scene. */
export async function runAudioEngine(
  provider: AIProvider,
  data: AudioInput,
  signal?: AbortSignal,
): Promise<AudioOutput> {
  const schema = AudioEngineOutputSchema.superRefine((out, ctx) => {
    exactSceneNumbers(out.scenes, data.scenes.length, ctx, "scenes");
    out.scenes.forEach((scene, i) => {
      const problem = audioModeProblem(scene);
      if (problem) ctx.addIssue({ code: "custom", path: ["scenes", i, "audioMode"], message: problem });
    });
  });
  return provider.generateStructured({
    task: "audio",
    schemaName: "audio",
    schema,
    input: data,
    signal,
    ...audioPrompt(data),
  });
}
