import "server-only";
import { SceneEngineOutputSchema } from "@/lib/schemas/engines";
import { scenesPrompt } from "@/prompts/scenes";
import type { AIProvider } from "../provider";
import type { SceneDetail, ScenesInput } from "./types";
import { exactSceneNumbers } from "./validation";

/** SCENE ENGINE — shootable scene breakdown with camera, motion and transitions. */
export async function runSceneEngine(
  provider: AIProvider,
  data: ScenesInput,
  signal?: AbortSignal,
): Promise<SceneDetail[]> {
  const known = new Set(data.characters.map((c) => c.name));
  const schema = SceneEngineOutputSchema.superRefine((out, ctx) => {
    exactSceneNumbers(out.scenes, data.input.sceneCount, ctx, "scenes");
    out.scenes.forEach((scene, i) =>
      scene.characters.forEach((name, j) => {
        if (!known.has(name)) {
          ctx.addIssue({
            code: "custom",
            path: ["scenes", i, "characters", j],
            message: `Unknown character "${name}". Use exact names: ${[...known].join(", ")}`,
          });
        }
      }),
    );
  });

  const { scenes } = await provider.generateStructured({
    task: "scenes",
    schemaName: "scenes",
    schema,
    input: data,
    signal,
    ...scenesPrompt(data),
  });
  // Durations are decided by the orchestrator, not the model, so the total always matches the brief.
  return scenes.map((s, i) => ({ ...s, duration: data.durations[i] }));
}
